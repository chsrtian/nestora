"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bath,
  BedDouble,
  Bot,
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  Map,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
  Wand2,
  WifiOff,
  Zap,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import { PageHeader } from "@/app/components/layout/page-header";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { formatPriceInPHP } from "@/lib/currency";

type Amenity = {
  id: string;
  name: string;
};

type PropertyAmenity = {
  amenity_id: string;
  amenities: { name: string } | null;
};

type Property = {
  id: string;
  title: string;
  description: string | null;
  property_type: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  price: number | null;
  deposit: number | null;
  advance: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  available_from: string | null;
  property_amenities?: PropertyAmenity[] | null;
  property_images?: { storage_path: string; is_cover: boolean }[] | null;
};

type EmbeddedOne<T> = T | T[] | null;

type PropertyAmenityRow = Omit<PropertyAmenity, "amenities"> & {
  amenities: EmbeddedOne<PropertyAmenity["amenities"]>;
};

type PropertyRow = Omit<Property, "property_amenities" | "property_images"> & {
  property_amenities?: PropertyAmenityRow[] | null;
  property_images?: { storage_path: string; is_cover: boolean }[] | null;
};

type Preferences = {
  city: string;
  near: string;
  propertyType: string;
  minBudget: string;
  maxBudget: string;
  amenityIds: string[];
  petFriendly?: boolean;
};

type Recommendation = {
  property: Property;
  score: number;
  scorePercent: number;
  reasons: string[];
  missing: string[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const DEFAULT_PREFERENCES: Preferences = {
  city: "",
  near: "",
  propertyType: "",
  minBudget: "",
  maxBudget: "",
  amenityIds: [],
};

const renterNavItems: SidebarNavItem[] = [
  { href: "/dashboard/renter", label: "Browse rentals", icon: Home },
  { href: "/dashboard/renter/map", label: "Map", icon: Map },
  {
    href: "/dashboard/renter/recommendations",
    label: "Recommendations",
    icon: Sparkles,
  },
  {
    href: "/dashboard/renter/assistant",
    label: "AI Assistant",
    icon: Bot,
    badge: "Premium",
  },
];

const LANDMARK_ALIAS_MAP: Array<{ aliases: string[]; landmark: string }> = [
  {
    aliases: [
      "CSU",
      "Caraga State University",
      "Caraga State University Cabadbaran",
      "CSU Cabadbaran",
      "Caraga State University - Cabadbaran Campus",
    ],
    landmark: "Caraga State University - Cabadbaran Campus",
  },
];

const resolveLandmark = (value: string): string | null => {
  const lower = normalize(value);
  for (const entry of LANDMARK_ALIAS_MAP) {
    if (entry.aliases.some((alias) => lower === normalize(alias))) {
      return entry.landmark;
    }
  }
  return null;
};

const EXAMPLE_PROMPTS = [
  "boarding house under 2500",
  "apartment near CSU with WiFi",
  "pangita kog apartment under 4000",
  "studio with parking and aircon",
];

const BUDGET_POINTS = 35;
const AMENITY_POINTS = 25;
const TYPE_POINTS = 20;
const LOCATION_POINTS = 20;
const NEUTRAL_FACTOR = 0.5;

const PROPERTY_TYPE_KEYWORDS = [
  { keyword: "boarding house", value: "boarding_house" },
  { keyword: "boardinghouse", value: "boarding_house" },
  { keyword: "boarding", value: "boarding_house" },
  { keyword: "apartment", value: "apartment" },
  { keyword: "studio", value: "apartment" },
  { keyword: "condo", value: "apartment" },
  { keyword: "house", value: "house" },
  { keyword: "inn", value: "inn" },
  { keyword: "lodge", value: "lodge" },
  { keyword: "pension", value: "pension_house" },
  { keyword: "resort", value: "resort" },
  { keyword: "room for rent", value: "room_for_rent" },
];

const AMENITY_KEYWORD_MAP: Array<{ aliases: string[]; amenityId: string }> = [
  { aliases: ["wifi", "wi-fi", "wi fi", "wireless", "internet"], amenityId: "wifi" },
  { aliases: ["parking", "car park", "carpark"], amenityId: "parking" },
  { aliases: ["aircon", "air con", "air conditioning", "ac"], amenityId: "aircon" },
  { aliases: ["kitchen"], amenityId: "kitchen" },
  { aliases: ["laundry", "washer"], amenityId: "laundry" },
  { aliases: ["security"], amenityId: "security" },
  { aliases: ["furnished", "furniture"], amenityId: "furnished" },
];

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

function formatPrice(value: number | null) {
  return formatPriceInPHP(value);
}

function formatCount(value: number | null) {
  return typeof value === "number" ? value : "Not listed";
}

function formatArea(value: number | null) {
  return typeof value === "number" ? `${value} sqm` : "Area not listed";
}

function formatLocation(property: Property) {
  return [property.city, property.state, property.country].filter(Boolean).join(", ");
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not specified";
}

const parseNumber = (value: string) => {
  if (!value.trim()) return null;
  const cleaned = value.replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

const createId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type AIParsedFilters = {
  intent?: string;
  skip_search?: boolean;
  property_type?: string;
  max_price?: number;
  min_price?: number;
  pet_friendly?: boolean;
  amenities?: string[];
  city?: string;
  near?: string;
  bedrooms?: number;
  move_in_date?: string;
};

type CombinedPreferences = Preferences & {
  petFriendly?: boolean;
};

function normalizeEmbeddedOne<T>(value: EmbeddedOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function normalizeProperties(rows: PropertyRow[]): Property[] {
  return rows.map((property) => ({
    ...property,
    property_amenities: property.property_amenities?.map((amenity) => ({
      ...amenity,
      amenities: normalizeEmbeddedOne(amenity.amenities),
    })) ?? null,
  }));
}

const scoreProperty = (
  property: Property,
  preferences: Preferences,
): Recommendation => {
  const reasons: string[] = [];
  const missing: string[] = [];

  const minBudget = parseNumber(preferences.minBudget);
  const maxBudget = parseNumber(preferences.maxBudget);
  const budgetProvided = minBudget !== null || maxBudget !== null;

  let budgetScore = 0;
  if (budgetProvided) {
    const price = property.price;
    const hasPrice = typeof price === "number";
    const meetsMin = hasPrice && (minBudget === null || price >= minBudget);
    const meetsMax = hasPrice && (maxBudget === null || price <= maxBudget);
    if (hasPrice && meetsMin && meetsMax) {
      budgetScore = BUDGET_POINTS;
      reasons.push("Within budget");
    } else {
      missing.push(hasPrice ? "Budget preference not met" : "Price not listed");
    }
  } else {
    budgetScore = BUDGET_POINTS * NEUTRAL_FACTOR;
    reasons.push("No budget preference set");
  }

  const preferredType = normalize(preferences.propertyType);
  const propertyType = normalize(property.property_type);
  let typeScore = 0;
  if (preferredType) {
    const matchesType =
      propertyType === preferredType ||
      (propertyType?.includes(preferredType) ?? false) ||
      (preferredType?.includes(propertyType) ?? false);
    if (matchesType) {
      typeScore = TYPE_POINTS;
      reasons.push("Property type matches");
    } else {
      missing.push("Property type does not match");
    }
  } else {
    typeScore = TYPE_POINTS * NEUTRAL_FACTOR;
    reasons.push("No property type preference set");
  }

  const preferredCity = normalize(preferences.city);
  const preferredNear = normalize(preferences.near);
  const propertyCity = normalize(property.city);
  const propertyAddress = normalize(property.address_line);
  const propertyTitle = normalize(property.title);
  let locationScore = 0;
  if (preferredCity || preferredNear) {
    const cityMatch = Boolean(
      preferredCity &&
        (propertyCity === preferredCity ||
          (propertyCity?.includes(preferredCity) ?? false) ||
          (preferredCity?.includes(propertyCity) ?? false)),
    );
    const nearMatch = Boolean(
      preferredNear &&
        (propertyCity?.includes(preferredNear) === true ||
          propertyAddress?.includes(preferredNear) === true ||
          propertyTitle?.includes(preferredNear) === true),
    );
    if (cityMatch || nearMatch) {
      locationScore = LOCATION_POINTS;
      reasons.push(cityMatch ? "City matches preference" : "Near landmark matches preference");
    } else {
      missing.push("Location preference not met");
    }
  } else {
    locationScore = LOCATION_POINTS * NEUTRAL_FACTOR;
    reasons.push("No location preference set");
  }

  const selectedAmenities = preferences.amenityIds;
  const propertyAmenityIds = (property.property_amenities ?? [])
    .map((item) => item.amenity_id)
    .filter((id): id is string => Boolean(id));

  let amenityScore = 0;
  if (selectedAmenities.length > 0) {
    const matches = selectedAmenities.filter((id) =>
      propertyAmenityIds.includes(id),
    );
    if (matches.length > 0) {
      amenityScore =
        (matches.length / selectedAmenities.length) * AMENITY_POINTS;
      reasons.push(
        `Matches ${matches.length} of ${selectedAmenities.length} amenities`,
      );
    } else {
      missing.push("No selected amenities matched");
    }
  } else {
    amenityScore = AMENITY_POINTS * NEUTRAL_FACTOR;
    reasons.push("No amenity preference set");
  }

  const totalScore = budgetScore + typeScore + locationScore + amenityScore;
  const scorePercent = Math.round(totalScore);

  return {
    property,
    score: totalScore,
    scorePercent,
    reasons,
    missing,
  };
};

const buildPreferenceSummary = (
  notes: string[],
  prefs: CombinedPreferences,
) => {
  if (notes.length > 0) return notes;
  const parts: string[] = [];
  if (prefs.city) parts.push(`City: ${prefs.city}`);
  if (prefs.near) parts.push(`Near: ${prefs.near}`);
  if (prefs.propertyType) parts.push(`Type: ${prefs.propertyType}`);
  if (prefs.minBudget)
    parts.push(`Min: ${formatPrice(parseNumber(prefs.minBudget) ?? 0)}`);
  if (prefs.maxBudget)
    parts.push(`Max: ${formatPrice(parseNumber(prefs.maxBudget))}`);
  parts.push(...prefs.amenityIds.map((id) => `Amenity: ${id}`));
  if (prefs.petFriendly) parts.push("Pet friendly");
  return parts;
};

export default function RenterAssistantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Tell me what kind of rental you want. Example: boarding house under 2500, apartment near CSU with WiFi, or pangita kog apartment under 4000.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [lastNotes, setLastNotes] = useState<string[]>([]);
  const [lastAmenityNames, setLastAmenityNames] = useState<string[]>([]);
  const [combinedPreferences, setCombinedPreferences] =
    useState<CombinedPreferences>(DEFAULT_PREFERENCES);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const el = chatEndRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const client = getSupabaseClient();
      if (!client) {
        if (!isMounted) return;
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (!isMounted) return;

      if (sessionError || !sessionData.session) {
        if (!isMounted) return;
        router.replace("/login");
        return;
      }

      setAuthCookie();
      setEmail(sessionData.session.user.email ?? null);
      setRenterId(sessionData.session.user.id);

      const { profile, error: profileError } = await ensureProfile(
        client,
        sessionData.session.user.id,
      );

      if (!isMounted) return;
      if (profileError || !profile) {
        setError("Profile not found. Please contact support.");
        setLoading(false);
        return;
      }
      if (profile.role !== "renter") {
        router.replace("/dashboard");
        return;
      }

      const { data: amenitiesData, error: amenitiesError } = await client
        .from("amenities")
        .select("id, name")
        .order("name");

      if (!isMounted) return;
      if (amenitiesError) {
        setError(amenitiesError.message);
        setLoading(false);
        return;
      }

      setAmenities(amenitiesData ?? []);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const amenityNamesLabel = useMemo(
    () => lastAmenityNames.join(", ") || "None",
    [lastAmenityNames],
  );

  const topScore = recommendations[0]?.scorePercent ?? null;

  const amenityAliasToDbId = useCallback(
    (signal: string): string | undefined => {
      const lower = normalize(signal);
      const match = amenities.find((amenity) => {
        const name = normalize(amenity.name);
        return lower === name || name.includes(lower) || lower.includes(name);
      });
      return match?.id;
    },
    [amenities],
  );

  const amenityIdsForSignals = useCallback(
    (signals: string[]): string[] => {
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const signal of signals) {
        const id = amenityAliasToDbId(signal);
        if (id && !seen.has(id)) {
          ids.push(id);
          seen.add(id);
        }
      }
      return ids;
    },
    [amenityAliasToDbId],
  );

  const buildLocalNotes = useCallback(
    (
      text: string,
    ): {
      notes: string[];
      amenityNames: string[];
      filters: CombinedPreferences;
    } => {
      const lower = normalize(text);
      const notes: string[] = [];
      const amenityNames: string[] = [];
      const prefs: CombinedPreferences = {
        ...DEFAULT_PREFERENCES,
        amenityIds: combinedPreferences.amenityIds,
      };

      const matchedType = PROPERTY_TYPE_KEYWORDS.find((entry) =>
        lower.includes(entry.keyword),
      );
      if (matchedType) {
        prefs.propertyType = matchedType.value;
        notes.push(`Property type: ${matchedType.value}`);
      }

      const budget: { min?: number; max?: number } = {};
      const normalizedMessage = lower.replace(/\b(?:php|pesos?)\b/gi, "");
      const maxPattern = /(?:under|below|max(?:imum)?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
      const minPattern = /(?:over|above|min(?:imum)?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
      const minMaxPattern =
        /(?:min(?:imum)?|from)\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:to|[-–]|and)\s*(?:max(?:imum)?|up to)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
      const minMaxMatch = normalizedMessage.match(minMaxPattern);
      if (minMaxMatch) {
        const min = parseNumber(minMaxMatch[1]);
        const max = parseNumber(minMaxMatch[2]);
        if (min !== null) {
          budget.min = min;
          notes.push(`Min budget: ${formatPrice(min)}`);
        }
        if (max !== null) {
          budget.max = max;
          notes.push(`Max budget: ${formatPrice(max)}`);
        }
      } else {
        const maxMatch = normalizedMessage.match(maxPattern);
        if (maxMatch) {
          const max = parseNumber(maxMatch[1]);
          if (max !== null) {
            budget.max = max;
            notes.push(`Max budget: ${formatPrice(max)}`);
          }
        }
        const minMatch = normalizedMessage.match(minPattern);
        if (minMatch) {
          const min = parseNumber(minMatch[1]);
          if (min !== null) {
            budget.min = min;
            notes.push(`Min budget: ${formatPrice(min)}`);
          }
        }
      }
      prefs.minBudget = budget.min !== undefined ? String(budget.min) : combinedPreferences.minBudget ?? "";
      prefs.maxBudget = budget.max !== undefined ? String(budget.max) : combinedPreferences.maxBudget ?? "";

      const petPatterns = [
        "pet friendly",
        "pets ok",
        "pet okay",
        "pets allowed",
        "allowed pets",
      ];
      if (petPatterns.some((pattern) => lower.includes(pattern))) {
        prefs.petFriendly = true;
        notes.push("Pet friendly");
      }

      const locationPatterns = ["duol sa", "duol", "near sa", "near", "close to"];
      let locationText = "";
      for (const pattern of locationPatterns) {
        const index = lower.indexOf(pattern);
        if (index !== -1) {
          locationText = lower.slice(index + pattern.length).trim();
          break;
        }
      }
      if (!locationText) {
        const csuMatch = lower.match(/cs[ua]/);
        if (csuMatch) {
          locationText = "CSU";
        }
      }
      const trimmedLocation = locationText
        .replace(/^(sa|ng|kita|tabok|baryo|bario|town|city)/i, "")
        .trim();
      if (trimmedLocation) {
        const canonicalLandmark = resolveLandmark(trimmedLocation);
        if (canonicalLandmark) {
          prefs.near = canonicalLandmark;
          notes.push(`Near: ${canonicalLandmark}`);
        } else {
          prefs.city = trimmedLocation;
          notes.push(`City: ${trimmedLocation}`);
        }
      }

      for (const aliasGroup of AMENITY_KEYWORD_MAP) {
        if (aliasGroup.aliases.some((alias) => lower.includes(alias))) {
          const id = amenityAliasToDbId(aliasGroup.aliases[0]);
          if (id) {
            if (!prefs.amenityIds.includes(id)) {
              prefs.amenityIds.push(id);
            }
            amenityNames.push(aliasGroup.aliases[0]);
            notes.push(`Amenity: ${aliasGroup.aliases[0]}`);
          }
        }
      }

      return { notes, amenityNames, filters: prefs };
    },
    [combinedPreferences, amenityAliasToDbId],
  );

  const fetchApprovedProperties = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setAssistantError(supabaseConfigError ?? "Supabase is not configured.");
      return [] as Property[];
    }

    const { data, error: propertiesError } = await client
      .from("properties")
      .select(
        "id, title, description, property_type, address_line, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, property_images(storage_path, is_cover), property_amenities(amenity_id, amenities(name))",
      )
      .eq("status", "approved");

    if (propertiesError) {
      setAssistantError(propertiesError.message);
      return [] as Property[];
    }

    return normalizeProperties((data ?? []) as PropertyRow[]);
  }, []);

  const logRecommendations = useCallback(
    async (items: Recommendation[]) => {
      if (!renterId || items.length === 0) return;
      const client = getSupabaseClient();
      if (!client) return;

      const rows = items.slice(0, 5).map((item) => ({
        renter_id: renterId,
        property_id: item.property.id,
        score: Number(item.score.toFixed(3)),
        reason: item.reasons.join("; "),
      }));

      const { error: insertError } = await client
        .from("recommendation_logs")
        .insert(rows);

      if (insertError) {
        return;
      }
    },
    [renterId],
  );

  const applyPreferencesAndSearch = useCallback(
    async (prefs: CombinedPreferences) => {
      const properties = await fetchApprovedProperties();
      const scored = properties.map((property) =>
        scoreProperty(property, prefs),
      );
      const sorted = scored
        .slice()
        .sort((a, b) => b.score - a.score)
        .filter((item) => item.score > 0);
      const topMatches = sorted.slice(0, 5);
      return topMatches;
    },
    [fetchApprovedProperties],
  );

  const mergeAiIntoPreferences = useCallback(
    (
      prefs: CombinedPreferences,
      ai: AIParsedFilters,
      isFollowup: boolean,
    ): CombinedPreferences => {
      const next: CombinedPreferences = {
        ...prefs,
        amenityIds: [...prefs.amenityIds],
      };
      if (!isFollowup) {
        next.city = "";
        next.near = "";
        next.propertyType = "";
        next.minBudget = "";
        next.maxBudget = "";
        next.amenityIds = [];
        next.petFriendly = undefined;
      }
      if (ai.property_type) next.propertyType = ai.property_type;
      if (typeof ai.max_price === "number")
        next.maxBudget = String(ai.max_price);
      if (typeof ai.min_price === "number")
        next.minBudget = String(ai.min_price);
      if (ai.city) next.city = ai.city;
      if (ai.near) next.near = ai.near;
      if (typeof ai.pet_friendly === "boolean")
        next.petFriendly = ai.pet_friendly;
      if (Array.isArray(ai.amenities)) {
        const newIds = amenityIdsForSignals(ai.amenities);
        for (const id of newIds) {
          if (!next.amenityIds.includes(id)) {
            next.amenityIds.push(id);
          }
        }
      }
      return next;
    },
    [amenityIdsForSignals],
  );

  const runLocalFallback = useCallback(
    async (text: string) => {
      const { amenityNames, filters: localPrefs } = buildLocalNotes(
        text,
      );
      const merged: CombinedPreferences = { ...combinedPreferences };
      merged.city = localPrefs.city;
      merged.near = localPrefs.near;
      if (localPrefs.propertyType) merged.propertyType = localPrefs.propertyType;
      if (localPrefs.minBudget) merged.minBudget = localPrefs.minBudget;
      if (localPrefs.maxBudget) merged.maxBudget = localPrefs.maxBudget;
      if (!merged.amenityIds.length) merged.amenityIds = localPrefs.amenityIds;

      setCombinedPreferences(merged);
      setLastNotes(buildPreferenceSummary([], merged));
      setLastAmenityNames(amenityNames);

      const topMatches = await applyPreferencesAndSearch(merged);
      setRecommendations(topMatches);
      setIsThinking(false);

      return topMatches;
    },
    [
      combinedPreferences,
      buildLocalNotes,
      applyPreferencesAndSearch,
    ],
  );

  const handleSend = useCallback(
    async () => {
      const text = input.trim();
      if (!text || isThinking) return;
      setInput("");
      setIsThinking(true);
      setUseFallback(false);
      setAiConfigError(null);
      setHasResults(false);
      focusComposer();

      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "user", content: text },
      ]);

      try {
        const response = await fetch("/api/ai/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const aiResponse = (await response.json().catch(() =>
          ({}),
        )) as { intent?: string; skip_search?: boolean; filters?: AIParsedFilters };

        const isGreeting = /^(hi|hello|hey|good (morning|afternoon|evening)|pila|unsa|kumusta)[\s!.,]*$/i.test(text.replace(/\?/g, ""));
        const isNonRental = [
          "weather",
          "game",
          "recipe",
          "joke",
          "news",
          "translate",
          "definition",
          "meaning",
          "essay",
          "code",
          "program",
          "script",
        ].some((term) => text.toLowerCase().includes(term));
        if (isGreeting || isNonRental) {
          const reply =
            isGreeting
              ? "Hello! Tell me what rental you want and I'll search approved listings."
              : "I only help with rental searches — please share a city, budget, or property type.";
          setMessages((prev) => [
            ...prev,
            { id: createId(), role: "assistant", content: reply },
          ]);
          setIsThinking(false);
          focusComposer();
          return;
        }

        const isFollowup =
          recommendations.length > 0 ||
          combinedPreferences.city !== "" ||
          combinedPreferences.maxBudget !== "";

        if (aiResponse.skip_search || aiResponse.intent === "general_chat") {
          const reply =
            aiResponse.filters && typeof aiResponse.filters === "object"
              ? `I only search rentals. Your filters: ${buildPreferenceSummary([], combinedPreferences).join(", ") || "none set yet."}`
              : `I only search rentals. To get started, share a city, budget, or property type.`;
          setMessages((prev) => [
            ...prev,
            { id: createId(), role: "assistant", content: reply },
          ]);
          setIsThinking(false);
          focusComposer();
          return;
        }

        const filters =
          aiResponse.filters && typeof aiResponse.filters === "object"
            ? (aiResponse.filters as AIParsedFilters)
            : {};

        const activePrefs = isFollowup
          ? mergeAiIntoPreferences(combinedPreferences, filters, true)
          : mergeAiIntoPreferences(combinedPreferences, filters, false);

        setCombinedPreferences(activePrefs);
        setLastNotes(buildPreferenceSummary([], activePrefs));
        if (Array.isArray(filters.amenities)) {
          setLastAmenityNames(
            filters.amenities.filter(
              (x): x is string => typeof x === "string",
            ),
          );
        }

        const topMatches = await applyPreferencesAndSearch(activePrefs);
        setRecommendations(topMatches);
        setHasResults(topMatches.length > 0);
        setIsThinking(false);

        const status = [
          activePrefs.propertyType ? `Type: ${activePrefs.propertyType}` : null,
          activePrefs.maxBudget
            ? `Max: ${formatPrice(parseNumber(activePrefs.maxBudget))}`
            : null,
          activePrefs.city ? `City: ${activePrefs.city}` : null,
          activePrefs.near ? `Near: ${activePrefs.near}` : null,
          activePrefs.petFriendly ? "Pet friendly" : null,
        ]
          .filter(Boolean)
          .join(" • ");

        const content =
          topMatches.length === 0
            ? `No approved rentals matched. Try adjusting: ${status || "add more filters like city, budget, or property type."}`
            : `Found ${topMatches.length} approved rental${topMatches.length === 1 ? "" : "s"} matching: ${status}.`;

        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "assistant", content },
        ]);
        focusComposer();
        void logRecommendations(topMatches);
      } catch {
        setUseFallback(true);
        const topMatches = await runLocalFallback(text);
        const content = topMatches.length
          ? `Found ${topMatches.length} match${topMatches.length === 1 ? "" : "es"} (fallback mode).`
          : "No matches right now. Try a different city or budget.";
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "assistant", content },
        ]);
        setHasResults(topMatches.length > 0);
        focusComposer();
        void logRecommendations(topMatches);
      }
    },
    [
      input,
      isThinking,
      focusComposer,
      combinedPreferences,
      recommendations,
      mergeAiIntoPreferences,
      applyPreferencesAndSearch,
      runLocalFallback,
      logRecommendations,
    ],
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      void handleSend();
    },
    [handleSend],
  );

   if (loading) {
     return (
       <AppShell
         navItems={renterNavItems}
         title="Nestora"
         showSearchHint={false}
       >
         <div className="mx-auto max-w-7xl space-y-6">
           <div className="space-y-3">
             <Skeleton className="h-8 w-72" />
             <Skeleton className="h-5 w-[34rem] max-w-full" />
           </div>
           <div className="grid gap-4 md:grid-cols-3">
             <Skeleton className="h-28 w-full" />
             <Skeleton className="h-28 w-full" />
             <Skeleton className="h-28 w-full" />
           </div>
           <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
             <Skeleton className="h-[620px] w-full" />
             <Skeleton className="h-[620px] w-full" />
           </div>
         </div>
       </AppShell>
     );
   }

   return (
     <AppShell
       navItems={renterNavItems}
       title="Nestora"
       topNavAction={email ? <Badge>{email}</Badge> : null}
       sidebarFooter={<LogoutButton />}
       showSearchHint={false}
       className="overflow-x-hidden pb-6"
     >
      <div className="mx-auto w-full max-w-7xl space-y-5 overflow-x-hidden">
        <PageHeader
          eyebrow="Intelligent discovery"
          title="Describe the rental you want"
          description="Type naturally in English, Taglish, or Bisaya. The assistant understands rental intent and extracts filters automatically from approved listings only."
          actions={
            <Badge variant="premium" className="px-3 py-1">
              <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Intent-aware assistant
            </Badge>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {useFallback ? (
          <AlertMessage variant="warning">
            <WifiOff className="mr-2 h-4 w-4 inline-block" aria-hidden="true" />
            AI service unavailable. Using local fallback matcher.
          </AlertMessage>
        ) : null}
        {aiConfigError ? (
          <AlertMessage variant="info">
            <AlertTriangle
              className="mr-2 h-4 w-4 inline-block"
              aria-hidden="true"
            />
            {aiConfigError}
          </AlertMessage>
        ) : null}
        {assistantError ? (
          <AlertMessage variant="danger">{assistantError}</AlertMessage>
        ) : null}

        <div className="grid w-full min-w-0 gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="flex h-[calc(100vh-15rem)] min-h-[620px] w-full min-w-0 max-w-full flex-col overflow-hidden xl:h-[calc(100vh-13rem)]">
            <CardHeader className="shrink-0 border-b border-neutral-200 p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>Rental assistant</CardTitle>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Ask for a rental and I will search approved listings. I only
                    help with rentals.
                  </p>
                </div>
                <Badge variant="success" className="shrink-0 px-3 py-1.5 text-xs">
                  Only rental search
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div
                aria-live="polite"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto bg-neutral-50 p-4 sm:p-5"
              >
                {messages.map((message) => {
                  const isAssistant = message.role === "assistant";
                  return (
                    <article
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        isAssistant ? "justify-start" : "justify-end",
                      )}
                    >
                      {isAssistant ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/20">
                          <Bot className="h-4 w-4" aria-hidden="true" />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "min-w-0 max-w-[82%] overflow-hidden rounded-xl border px-4 py-3 text-sm leading-6 shadow-sm",
                          isAssistant
                            ? "border-neutral-200 bg-white text-neutral-700"
                            : "border-violet-500 bg-violet-500 text-white",
                        )}
                      >
                        <p className="mb-1 text-xs font-medium uppercase opacity-60">
                          {isAssistant ? "Assistant" : "You"}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </article>
                  );
                })}
                {isThinking ? (
                  <div className="flex justify-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/20">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Understanding your request...
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <div className="shrink-0 overflow-x-hidden border-t border-neutral-200 bg-white p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setInput(prompt);
                        focusComposer();
                      }}
                      disabled={isThinking}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageSquare
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      {prompt}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSend();
                  }}
                  className="w-full rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-500/10"
                >
                  <label htmlFor="assistant-message" className="sr-only">
                    Message rental assistant
                  </label>
                  <div className="flex min-w-0 items-end gap-2">
                    <Textarea
                      ref={composerRef}
                      id="assistant-message"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      disabled={isThinking}
                      placeholder="Message the rental assistant..."
                      rows={2}
                      className="min-h-12 min-w-0 max-h-40 resize-none border-0 px-2 py-2 shadow-none focus:border-transparent focus:ring-0"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isThinking || input.trim().length === 0}
                      aria-label={isThinking ? "Matching rentals" : "Send message"}
                      className="mb-1 shrink-0 rounded-full"
                    >
                      {isThinking ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle>Parsed preferences</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  Filters extracted by the assistant from your last message.
                </p>
              </CardHeader>
              <CardContent className="p-4">
                {lastNotes.length === 0 ? (
                  <EmptyState
                    title="No preferences parsed yet"
                    description="Send a message with a city, budget, property type, or amenity."
                    icon={<Wand2 className="h-5 w-5" aria-hidden="true" />}
                    className="p-6"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lastNotes.map((note) => (
                      <Badge key={note} variant="premium">
                        {note}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle>Detected amenities</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  Matched against the marketplace amenities list.
                </p>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm leading-6 text-neutral-600">
                  {amenityNamesLabel}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <section aria-label="Assistant recommendations" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                Matching rentals
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                Real approved rentals returned from the database. No invented
                results.
              </p>
            </div>
            <Badge variant="success">Approved only</Badge>
          </div>

          {isThinking ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              title={
                hasResults
                  ? "No approved rentals matched that request"
                  : "Matches will appear here"
              }
              description={
                hasResults
                  ? "Try a broader city, a higher budget, or fewer amenity requirements."
                  : "Send a rental brief to receive up to five ranked matches."
              }
              icon={<Bot className="h-5 w-5" aria-hidden="true" />}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {recommendations.map((item, index) => {
                const { property, reasons, missing, scorePercent } = item;
                const amenityNamesForProperty = (
                  property.property_amenities ?? []
                )
                  .map((amenity) => amenity.amenities?.name)
                  .filter((name): name is string => Boolean(name));
                const cover =
                  property.property_images?.find((image) => image.is_cover) ??
                  property.property_images?.[0];
                const description = property.description?.trim();

                return (
                  <article
                    key={property.id}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
                  >
                    <div className="aspect-[4/3] bg-neutral-100 sm:aspect-[16/7]">
                      {cover?.storage_path ? (
                        <img
                          src={cover.storage_path}
                          alt={property.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-500">
                          <Building2 className="h-10 w-10" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Match #{index + 1}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-neutral-950">
                          {property.title}
                        </h3>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span>
                            {formatLocation(property) || "Location unavailable"}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                        <p className="text-lg font-semibold text-neutral-950">
                          {scorePercent}%
                        </p>
                        <p className="text-xs text-neutral-500">match</p>
                      </div>
                    </div>
                    {description ? (
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-600">
                        {description}
                      </p>
                    ) : null}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Price
                        </p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {formatPrice(property.price)}
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Type
                        </p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {property.property_type || "Not specified"}
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-400">
                          <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
                          Beds
                        </p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {formatCount(property.bedrooms)}
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-400">
                          <Bath className="h-3.5 w-3.5" aria-hidden="true" />
                          Baths
                        </p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {formatCount(property.bathrooms)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 text-sm lg:grid-cols-2">
                      <div>
                        <p className="font-medium text-neutral-950">Details</p>
                        <p className="mt-1 leading-6 text-neutral-600">
                          Deposit {formatPrice(property.deposit)} / Advance{" "}
                          {formatPrice(property.advance)}
                        </p>
                        <p className="leading-6 text-neutral-600">
                          {formatArea(property.area_sqm)} / Available{" "}
                          {formatDate(property.available_from)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-neutral-950">Amenities</p>
                        <p className="mt-1 leading-6 text-neutral-600">
                          {amenityNamesForProperty.join(", ") || "Not specified"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-neutral-100 pt-5 lg:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-950">
                          Matched
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {reasons.map((reason) => (
                            <Badge key={reason} variant="success">
                              <CheckCircle2
                                className="mr-1 h-3 w-3"
                                aria-hidden="true"
                              />
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-950">
                          Tradeoffs
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {missing.length > 0 ? (
                            missing.map((itemMissing) => (
                              <Badge key={itemMissing} variant="warning">
                                {itemMissing}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="success">No major gaps</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          aria-label="Assistant signals"
          className="grid gap-3 border-t border-neutral-200 pt-4 md:grid-cols-4"
        >
          {[
            {
              label: "Mode",
              value: useFallback ? "Fallback" : "AI",
              icon: useFallback ? (
                <WifiOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              ),
            },
            {
              label: "Signals",
              value: lastNotes.length,
              icon: <Wand2 className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Matches",
              value: recommendations.length,
              icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Best score",
              value: topScore === null ? "N/A" : `${topScore}%`,
              icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-600">
                {stat.icon}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-400">
                  {stat.label}
                </p>
                <p className="text-lg font-semibold tracking-tight text-neutral-950">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
