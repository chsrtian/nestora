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
  lat: number | null;
  lng: number | null;
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
  preferredLat: string;
  preferredLng: string;
  maxDistanceKm: string;
};

type Recommendation = {
  property: Property;
  score: number;
  scorePercent: number;
  reasons: string[];
  missing: string[];
};

const DEFAULT_PREFERENCES: Preferences = {
  city: "",
  propertyType: "",
  minBudget: "",
  maxBudget: "",
  amenityIds: [],
  preferredLat: "",
  preferredLng: "",
  maxDistanceKm: "",
};

const BUDGET_POINTS = 35;
const AMENITY_POINTS = 25;
const TYPE_POINTS = 20;
const LOCATION_POINTS = 20;
const NEUTRAL_FACTOR = 0.5;

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const parseNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const radius = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
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
    if (preferredType === propertyType) {
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
  const preferredLat = parseNumber(preferences.preferredLat);
  const preferredLng = parseNumber(preferences.preferredLng);
  const maxDistanceKm = parseNumber(preferences.maxDistanceKm);
  const distanceProvided =
    preferredLat !== null &&
    preferredLng !== null &&
    maxDistanceKm !== null &&
    maxDistanceKm > 0;

  let locationScore = 0;
  if (preferredCity && preferredCity === propertyCity) {
    locationScore = LOCATION_POINTS;
    reasons.push("City matches preference");
  } else if (distanceProvided) {
    if (typeof property.lat === "number" && typeof property.lng === "number") {
      const distance = haversineKm(
        preferredLat!,
        preferredLng!,
        property.lat,
        property.lng,
      );
      if (distance <= maxDistanceKm) {
        locationScore = LOCATION_POINTS;
        reasons.push("Within distance preference");
      } else {
        missing.push("Outside preferred distance");
      }
    } else {
      missing.push("Property has no coordinates for distance check");
    }
  } else if (!preferredCity) {
    locationScore = LOCATION_POINTS * NEUTRAL_FACTOR;
    reasons.push("No location preference set");
  } else {
    missing.push("City preference not met");
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

export default function RenterRecommendationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] =
    useState<string | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [renterId, setRenterId] = useState<string | null>(null);

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

  const selectedAmenityNames = useMemo(() => {
    const selected = new Set(preferences.amenityIds);
    return amenities
      .filter((amenity) => selected.has(amenity.id))
      .map((amenity) => amenity.name);
  }, [amenities, preferences.amenityIds]);

  const onPreferenceChange = (key: keyof Preferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAmenity = (amenityId: string) => {
    setPreferences((prev) => {
      const next = new Set(prev.amenityIds);
      if (next.has(amenityId)) {
        next.delete(amenityId);
      } else {
        next.add(amenityId);
      }
      return { ...prev, amenityIds: Array.from(next) };
    });
  };

  const onUseLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not available in this browser.");
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPreferences((prev) => ({
          ...prev,
          preferredLat: position.coords.latitude.toFixed(6),
          preferredLng: position.coords.longitude.toFixed(6),
        }));
      },
      () => {
        setLocationError("Unable to access your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const fetchApprovedProperties = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setRecommendationError(supabaseConfigError ?? "Supabase is not configured.");
      return [] as Property[];
    }

    const { data, error: propertiesError } = await client
      .from("properties")
      .select(
        "id, title, description, property_type, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, lat, lng, property_amenities(amenity_id, amenities(name))",
      )
      .eq("status", "approved");

    if (propertiesError) {
      setRecommendationError(propertiesError.message);
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

  const onRecommend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecommendationError(null);

    const minBudget = parseNumber(preferences.minBudget);
    const maxBudget = parseNumber(preferences.maxBudget);
    if (
      minBudget !== null &&
      maxBudget !== null &&
      minBudget > maxBudget
    ) {
      setRecommendationError("Minimum budget cannot be greater than maximum budget.");
      return;
    }

    const maxDistance = parseNumber(preferences.maxDistanceKm);
    if (preferences.maxDistanceKm && (maxDistance === null || maxDistance <= 0)) {
      setRecommendationError("Max distance must be a positive number.");
      return;
    }

    setIsGenerating(true);
    setHasSearched(true);

    const properties = await fetchApprovedProperties();
    const scored = properties.map((property) =>
      scoreProperty(property, preferences),
    );
    const sorted = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .filter((item) => item.score > 0);

    setRecommendations(sorted);
    setIsGenerating(false);
    void logRecommendations(sorted);
  };

  const onClearResults = () => {
    setRecommendations([]);
    setHasSearched(false);
    setRecommendationError(null);
  };

  if (loading) {
    return (
      <main>
        <p>Loading recommendations...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Renter Recommendations</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: renter</p>

      <section aria-label="Recommendation form">
        <h2>Your preferences</h2>
        <form onSubmit={onRecommend}>
          <label>
            Preferred city
            <input
              type="text"
              value={preferences.city}
              onChange={(event) => onPreferenceChange("city", event.target.value)}
            />
          </label>
          <label>
            Preferred property type
            <input
              type="text"
              value={preferences.propertyType}
              onChange={(event) =>
                onPreferenceChange("propertyType", event.target.value)
              }
            />
          </label>
          <label>
            Minimum budget
            <input
              type="number"
              min="0"
              step="0.01"
              value={preferences.minBudget}
              onChange={(event) =>
                onPreferenceChange("minBudget", event.target.value)
              }
            />
          </label>
          <label>
            Maximum budget
            <input
              type="number"
              min="0"
              step="0.01"
              value={preferences.maxBudget}
              onChange={(event) =>
                onPreferenceChange("maxBudget", event.target.value)
              }
            />
          </label>

          <fieldset>
            <legend>Selected amenities</legend>
            {amenities.length === 0 ? (
              <p>No amenities available.</p>
            ) : (
              amenities.map((amenity) => (
                <label key={amenity.id} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={preferences.amenityIds.includes(amenity.id)}
                    onChange={() => toggleAmenity(amenity.id)}
                  />
                  {amenity.name}
                </label>
              ))
            )}
          </fieldset>

          <fieldset>
            <legend>Optional location preference</legend>
            <label>
              Preferred latitude
              <input
                type="number"
                step="any"
                value={preferences.preferredLat}
                onChange={(event) =>
                  onPreferenceChange("preferredLat", event.target.value)
                }
              />
            </label>
            <label>
              Preferred longitude
              <input
                type="number"
                step="any"
                value={preferences.preferredLng}
                onChange={(event) =>
                  onPreferenceChange("preferredLng", event.target.value)
                }
              />
            </label>
            <label>
              Max distance (km)
              <input
                type="number"
                min="0"
                step="0.1"
                value={preferences.maxDistanceKm}
                onChange={(event) =>
                  onPreferenceChange("maxDistanceKm", event.target.value)
                }
              />
            </label>
            <div>
              <button type="button" onClick={onUseLocation}>
                Use my location
              </button>
              {locationError ? <p role="alert">{locationError}</p> : null}
            </div>
          </fieldset>

          <div>
            <button type="submit" disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Get recommendations"}
            </button>
            <button type="button" onClick={onClearResults}>
              Clear results
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Recommendation results">
        <h2>Top matches</h2>
        {recommendationError ? <p role="alert">{recommendationError}</p> : null}
        {isGenerating ? (
          <p>Calculating recommendations...</p>
        ) : recommendations.length === 0 ? (
          <p>
            {hasSearched
              ? "No approved properties matched your preferences yet."
              : "No recommendations yet. Submit your preferences to see matches."}
          </p>
        ) : (
          <div>
            {recommendations.map((item) => {
              const { property, reasons, missing, scorePercent } = item;
              const amenityNames = (property.property_amenities ?? [])
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
                  {amenityNames.length > 0 ? (
                    <p>Amenities: {amenityNames.join(", ")}</p>
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
        <h2>Preference summary</h2>
        <p>Selected amenities: {selectedAmenityNames.join(", ") || "None"}</p>
      </section>

      <p>
        Testing note: Until admin approval is implemented, manually approve a
        property in Supabase using{` update properties set status = 'approved' where id = '';`}.
      </p>

      <LogoutButton />
    </main>
  );
}
