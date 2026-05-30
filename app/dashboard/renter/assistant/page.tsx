"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  Bot,
  CheckCircle2,
  Home,
  Loader2,
  Map,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
  Wand2,
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
  city: string | null;
  state: string | null;
  country: string | null;
  price: number;
  deposit: number;
  advance: number;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  available_from: string | null;
  property_amenities?: PropertyAmenity[] | null;
};

type EmbeddedOne<T> = T | T[] | null;

type PropertyAmenityRow = Omit<PropertyAmenity, "amenities"> & {
  amenities: EmbeddedOne<PropertyAmenity["amenities"]>;
};

type PropertyRow = Omit<Property, "property_amenities"> & {
  property_amenities?: PropertyAmenityRow[] | null;
};

type Preferences = {
  city: string;
  propertyType: string;
  minBudget: string;
  maxBudget: string;
  amenityIds: string[];
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

const EXAMPLE_PROMPTS = [
  "Apartment in Cabadbaran under 5000 with WiFi",
  "Boarding house with parking below 4000",
  "Studio near the city center with aircon",
];

const BUDGET_POINTS = 35;
const AMENITY_POINTS = 25;
const TYPE_POINTS = 20;
const LOCATION_POINTS = 20;
const NEUTRAL_FACTOR = 0.5;

const PROPERTY_TYPE_KEYWORDS = [
  { keyword: "boarding house", value: "boarding house" },
  { keyword: "boardinghouse", value: "boarding house" },
  { keyword: "boarding", value: "boarding house" },
  { keyword: "apartment", value: "apartment" },
  { keyword: "studio", value: "studio" },
  { keyword: "house", value: "house" },
];

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildAmenityAliases = (name: string) => {
  const lower = normalize(name);
  const aliases = new Set<string>([lower]);

  if (lower.includes("wifi") || lower.includes("wi-fi") || lower.includes("wireless")) {
    aliases.add("wifi");
    aliases.add("wi fi");
    aliases.add("wi-fi");
    aliases.add("wireless");
  }

  if (lower.includes("aircon") || lower.includes("air con") || lower.includes("air conditioning")) {
    aliases.add("aircon");
    aliases.add("air con");
    aliases.add("air conditioning");
  }

  if (lower.includes("parking")) {
    aliases.add("parking");
    aliases.add("car park");
    aliases.add("carpark");
  }

  return Array.from(aliases);
};

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
    const meetsMin = minBudget === null || property.price >= minBudget;
    const meetsMax = maxBudget === null || property.price <= maxBudget;
    if (meetsMin && meetsMax) {
      budgetScore = BUDGET_POINTS;
      reasons.push("Within budget");
    } else {
      missing.push("Budget preference not met");
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
      propertyType.includes(preferredType) ||
      preferredType.includes(propertyType);
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
  const propertyCity = normalize(property.city);
  let locationScore = 0;
  if (preferredCity) {
    if (propertyCity === preferredCity || propertyCity.includes(preferredCity)) {
      locationScore = LOCATION_POINTS;
      reasons.push("City matches preference");
    } else {
      missing.push("City preference not met");
    }
  } else {
    locationScore = LOCATION_POINTS * NEUTRAL_FACTOR;
    reasons.push("No location preference set");
  }

  const selectedAmenities = preferences.amenityIds;
  const propertyAmenityIds = (property.property_amenities ?? [])
    .map((item) => item.amenity_id)
    .filter(Boolean);

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

const parseBudget = (message: string) => {
  const result: { min?: number; max?: number } = {};

  const rangePattern = /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:to|[-–])\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
  const minMaxPattern =
    /min(?:imum)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:to|[-–]|and)?\s*max(?:imum)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
  const maxPattern =
    /(?:under|below|max(?:imum)?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;
  const minPattern =
    /(?:over|above|min(?:imum)?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i;

  const minMaxMatch = message.match(minMaxPattern);
  if (minMaxMatch) {
    const min = parseNumber(minMaxMatch[1]);
    const max = parseNumber(minMaxMatch[2]);
    if (min !== null) result.min = min;
    if (max !== null) result.max = max;
    return result;
  }

  const rangeMatch = message.match(rangePattern);
  if (rangeMatch) {
    const min = parseNumber(rangeMatch[1]);
    const max = parseNumber(rangeMatch[2]);
    if (min !== null) result.min = min;
    if (max !== null) result.max = max;
    return result;
  }

  const maxMatch = message.match(maxPattern);
  if (maxMatch) {
    const max = parseNumber(maxMatch[1]);
    if (max !== null) result.max = max;
  }

  const minMatch = message.match(minPattern);
  if (minMatch) {
    const min = parseNumber(minMatch[1]);
    if (min !== null) result.min = min;
  }

  return result;
};

const parseMessageToPreferences = (
  message: string,
  amenities: Amenity[],
  properties: Property[],
): {
  preferences: Preferences;
  notes: string[];
  amenityNames: string[];
  error?: string;
} => {
  const lower = normalize(message);
  const notes: string[] = [];
  const preferences: Preferences = { ...DEFAULT_PREFERENCES };

  const matchedType = PROPERTY_TYPE_KEYWORDS.find((entry) =>
    lower.includes(entry.keyword),
  );
  if (matchedType) {
    preferences.propertyType = matchedType.value;
    notes.push(`Property type: ${matchedType.value}`);
  }

  const budget = parseBudget(lower);
  if (budget.min !== undefined) {
    preferences.minBudget = String(budget.min);
    notes.push(`Min budget: ${budget.min}`);
  }
  if (budget.max !== undefined) {
    preferences.maxBudget = String(budget.max);
    notes.push(`Max budget: ${budget.max}`);
  }

  const cityOptions = Array.from(
    new Set(
      properties
        .map((property) => normalize(property.city))
        .filter((city) => city),
    ),
  ).sort((a, b) => b.length - a.length);

  for (const city of cityOptions) {
    const cityPattern = new RegExp(`\\b${escapeRegExp(city)}\\b`, "i");
    if (cityPattern.test(lower)) {
      preferences.city = city;
      notes.push(`City: ${city}`);
      break;
    }
  }

  const matchedAmenities: Amenity[] = [];
  amenities.forEach((amenity) => {
    const aliases = buildAmenityAliases(amenity.name);
    if (aliases.some((alias) => lower.includes(alias))) {
      matchedAmenities.push(amenity);
    }
  });

  if (matchedAmenities.length > 0) {
    preferences.amenityIds = matchedAmenities.map((amenity) => amenity.id);
    notes.push(
      `Amenities: ${matchedAmenities.map((amenity) => amenity.name).join(", ")}`,
    );
  }

  const amenityNames = matchedAmenities.map((amenity) => amenity.name);

  const minBudget = parseNumber(preferences.minBudget);
  const maxBudget = parseNumber(preferences.maxBudget);
  if (
    minBudget !== null &&
    maxBudget !== null &&
    minBudget > maxBudget
  ) {
    return {
      preferences,
      notes,
      amenityNames,
      error: "Your minimum budget is higher than your maximum budget.",
    };
  }

  return { preferences, notes, amenityNames };
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
        "Hi! Tell me what kind of rental you are looking for. Example: I need a boarding house in Cabadbaran under 5000 with WiFi and parking.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [lastNotes, setLastNotes] = useState<string[]>([]);
  const [lastAmenityNames, setLastAmenityNames] = useState<string[]>([]);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData.session) {
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

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const fetchApprovedProperties = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setAssistantError(supabaseConfigError ?? "Supabase is not configured.");
      return [] as Property[];
    }

    const { data, error: propertiesError } = await client
      .from("properties")
      .select(
        "id, title, description, property_type, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, property_amenities(amenity_id, amenities(name))",
      )
      .eq("status", "approved");

    if (propertiesError) {
      setAssistantError(propertiesError.message);
      return [] as Property[];
    }

    return normalizeProperties((data ?? []) as PropertyRow[]);
  };

  const logRecommendations = async (items: Recommendation[]) => {
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
  };

  const onSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssistantError(null);

    const text = input.trim();
    if (!text) {
      setAssistantError("Please enter a message to describe your rental needs.");
      return;
    }

    addMessage({ id: createId(), role: "user", content: text });
    setInput("");
    setIsThinking(true);
    setHasResults(true);

    const properties = await fetchApprovedProperties();
    const parseResult = parseMessageToPreferences(text, amenities, properties);

    if (parseResult.error) {
      addMessage({
        id: createId(),
        role: "assistant",
        content: parseResult.error,
      });
      setLastNotes(parseResult.notes);
      setLastAmenityNames(parseResult.amenityNames);
      setRecommendations([]);
      setIsThinking(false);
      return;
    }

    if (parseResult.notes.length === 0) {
      addMessage({
        id: createId(),
        role: "assistant",
        content:
          "I could not detect specific preferences yet. Try adding a city, budget, property type, or amenity.",
      });
      setLastNotes([]);
      setLastAmenityNames([]);
      setRecommendations([]);
      setIsThinking(false);
      return;
    }

    const scored = properties.map((property) =>
      scoreProperty(property, parseResult.preferences),
    );
    const sorted = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .filter((item) => item.score > 0);
    const topMatches = sorted.slice(0, 5);

    setLastNotes(parseResult.notes);
    setLastAmenityNames(parseResult.amenityNames);
    setRecommendations(topMatches);
    setIsThinking(false);

    if (topMatches.length === 0) {
      addMessage({
        id: createId(),
        role: "assistant",
        content:
          "I could not find matches with those preferences. Try adjusting your budget, city, or amenities.",
      });
      return;
    }

    addMessage({
      id: createId(),
      role: "assistant",
      content: `I found ${topMatches.length} match${topMatches.length === 1 ? "" : "es"}. See the top recommendations below.`,
    });

    void logRecommendations(topMatches);
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Rental Marketplace">
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
      title="Rental Marketplace"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="pb-6"
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="Premium discovery assistant"
          title="Describe the rental you want"
          description="The assistant reads your message, extracts known rental signals, and ranks approved properties with the existing rule-based matcher."
          actions={
            <Badge variant="premium" className="px-3 py-1">
              Rule-based assistant
            </Badge>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-neutral-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Discovery chat</CardTitle>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Use natural phrasing; no external AI services are called.
                  </p>
                </div>
                <Badge variant="info">Local rules</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                aria-live="polite"
                className="min-h-[420px] max-h-[560px] space-y-4 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4"
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
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white">
                          <Bot className="h-4 w-4" aria-hidden="true" />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6",
                          isAssistant
                            ? "border-neutral-200 bg-white text-neutral-700"
                            : "border-neutral-950 bg-neutral-950 text-white",
                        )}
                      >
                        <p className="mb-1 text-xs font-medium uppercase opacity-60">
                          {isAssistant ? "Assistant" : "You"}
                        </p>
                        <p>{message.content}</p>
                      </div>
                    </article>
                  );
                })}
                {isThinking ? (
                  <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Matching approved rentals...
                  </div>
                ) : null}
              </div>

              {assistantError ? (
                <AlertMessage variant="danger">{assistantError}</AlertMessage>
              ) : null}

              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm font-medium text-neutral-950">
                  Prompt suggestions
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="secondary"
                      onClick={() => setInput(prompt)}
                      disabled={isThinking}
                      className="h-auto max-w-full justify-start whitespace-normal py-2 text-left leading-5"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>

              <form onSubmit={onSend} className="space-y-3">
                <label
                  htmlFor="assistant-message"
                  className="text-sm font-medium text-neutral-950"
                >
                  Your rental brief
                </label>
                <Textarea
                  id="assistant-message"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="e.g. apartment in Cabadbaran under 5000 with WiFi"
                  rows={4}
                />
                <Button type="submit" disabled={isThinking} className="w-full">
                  {isThinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isThinking ? "Matching..." : "Find matches"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle>Parsed preferences</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  Signals detected by the current rule parser.
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
                Assistant picks
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                Top approved rentals returned by the existing matching logic.
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
                  : "Assistant matches will appear here"
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
                const amenityNamesForProperty = (property.property_amenities ?? [])
                  .map((amenity) => amenity.amenities?.name)
                  .filter((name): name is string => Boolean(name));

                return (
                  <article
                    key={property.id}
                    className="rounded-lg border border-neutral-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Assistant pick #{index + 1}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-neutral-950">
                          {property.title}
                        </h3>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span>{formatLocation(property) || "Location unavailable"}</span>
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                        <p className="text-lg font-semibold text-neutral-950">
                          {scorePercent}%
                        </p>
                        <p className="text-xs text-neutral-500">match</p>
                      </div>
                    </div>

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
                          {property.bedrooms}
                        </p>
                      </div>
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-400">
                          <Bath className="h-3.5 w-3.5" aria-hidden="true" />
                          Baths
                        </p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {property.bathrooms}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 text-sm lg:grid-cols-2">
                      <div>
                        <p className="font-medium text-neutral-950">Details</p>
                        <p className="mt-1 leading-6 text-neutral-600">
                          Deposit {property.deposit} / Advance {property.advance}
                        </p>
                        <p className="leading-6 text-neutral-600">
                          {property.area_sqm} sqm / Available{" "}
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
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Assistant signals" className="grid gap-3 md:grid-cols-3">
          {[
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
