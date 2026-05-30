"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/logout-button";
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
      <main>
        <p>Loading rental assistant...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Renter Assistant</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: renter</p>

      <section aria-label="Assistant chat">
        <h2>Assistant chat</h2>
        <div aria-live="polite">
          {messages.map((message) => (
            <article key={message.id}>
              <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
        {assistantError ? <p role="alert">{assistantError}</p> : null}
        {isThinking ? <p>Assistant is thinking...</p> : null}
        <form onSubmit={onSend}>
          <label>
            Your message
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. apartment in Cabadbaran under 5000 with WiFi"
            />
          </label>
          <button type="submit" disabled={isThinking}>
            {isThinking ? "Sending..." : "Send"}
          </button>
        </form>
      </section>

      <section aria-label="Parsed preferences">
        <h2>Parsed preferences</h2>
        {lastNotes.length === 0 ? (
          <p>No parsed preferences yet.</p>
        ) : (
          <ul>
            {lastNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Assistant recommendations">
        <h2>Top matches</h2>
        {isThinking ? (
          <p>Preparing recommendations...</p>
        ) : recommendations.length === 0 ? (
          <p>
            {hasResults
              ? "No approved properties matched your request yet."
              : "No recommendations yet. Send a message to get started."}
          </p>
        ) : (
          <div>
            {recommendations.map((item) => {
              const { property, reasons, missing, scorePercent } = item;
              const amenityNamesForProperty = (property.property_amenities ?? [])
                .map((amenity) => amenity.amenities?.name)
                .filter((name): name is string => Boolean(name));

              return (
                <article key={property.id}>
                  <h3>{property.title}</h3>
                  <p>Match score: {scorePercent}%</p>
                  <p>
                    Location: {property.city || ""}
                    {property.state ? `, ${property.state}` : ""}
                    {property.country ? `, ${property.country}` : ""}
                  </p>
                  <p>Type: {property.property_type || "Not specified"}</p>
                  <p>Price: {property.price}</p>
                  <p>Deposit: {property.deposit}</p>
                  <p>Advance: {property.advance}</p>
                  <p>Bedrooms: {property.bedrooms}</p>
                  <p>Bathrooms: {property.bathrooms}</p>
                  <p>Area (sqm): {property.area_sqm}</p>
                  <p>
                    Available from:{" "}
                    {property.available_from
                      ? new Date(property.available_from).toLocaleDateString()
                      : "Not specified"}
                  </p>
                  {amenityNamesForProperty.length > 0 ? (
                    <p>Amenities: {amenityNamesForProperty.join(", ")}</p>
                  ) : (
                    <p>Amenities: Not specified</p>
                  )}
                  {reasons.length > 0 ? (
                    <p>Matched: {reasons.join("; ")}</p>
                  ) : null}
                  {missing.length > 0 ? (
                    <p>Missing: {missing.join("; ")}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Summary">
        <h2>Summary</h2>
        <p>Detected amenities: {amenityNamesLabel}</p>
      </section>

      <p>
        Testing note: Until admin approval is implemented, manually approve a
        property in Supabase using{` update properties set status = 'approved' where id = '';`}.
      </p>

      <LogoutButton />
    </main>
  );
}
