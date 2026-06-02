"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Check,
  Crosshair,
  Home,
  Loader2,
  Map,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
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
  lat: number | null;
  lng: number | null;
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

function formatPrice(value: number | null) {
  return formatPriceInPHP(value);
}

function formatLocation(property: Property) {
  return [property.city, property.state, property.country].filter(Boolean).join(", ");
}

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
    property_images: property.property_images ?? null,
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

  const activePreferenceCount = useMemo(() => {
    const textPreferences = [
      preferences.city,
      preferences.propertyType,
      preferences.minBudget,
      preferences.maxBudget,
      preferences.preferredLat,
      preferences.preferredLng,
      preferences.maxDistanceKm,
    ].filter((value) => value.trim()).length;

    return textPreferences + (preferences.amenityIds.length > 0 ? 1 : 0);
  }, [preferences]);

  const topScore = recommendations[0]?.scorePercent ?? null;

  const preferenceSummary = useMemo(() => {
    const items: string[] = [];
    const city = preferences.city.trim();
    const type = preferences.propertyType.trim();
    const minBudget = preferences.minBudget.trim();
    const maxBudget = preferences.maxBudget.trim();
    const minBudgetValue = parseNumber(preferences.minBudget);
    const maxBudgetValue = parseNumber(preferences.maxBudget);
    const maxDistance = preferences.maxDistanceKm.trim();

    if (city) items.push(city);
    if (minBudget || maxBudget) {
      items.push(
        `${minBudgetValue !== null ? formatPrice(minBudgetValue) : "Any"}-${maxBudgetValue !== null ? formatPrice(maxBudgetValue) : "no limit"}`,
      );
    }
    if (type) items.push(type);
    items.push(...selectedAmenityNames);
    if (
      preferences.preferredLat.trim() &&
      preferences.preferredLng.trim() &&
      maxDistance
    ) {
      items.push(`Within ${maxDistance} km`);
    }

    return items;
  }, [preferences, selectedAmenityNames]);

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
        "id, title, description, property_type, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, lat, lng, property_images(storage_path, is_cover), property_amenities(amenity_id, amenities(name))",
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
      <AppShell navItems={renterNavItems} title="Nestora">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-80" />
              <Skeleton className="h-5 w-[34rem] max-w-full" />
            </div>
            <Skeleton className="h-10 w-44" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-[460px] w-full" />
          <Skeleton className="h-20 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
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
      className="!px-3 !py-3 !pb-8 sm:!px-4 lg:!px-6"
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Find your strongest rental matches
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 sm:text-base">
              Set your preferences first. Approved listings are ranked and scored by
              how well they fit.
            </p>
          </div>
          <Badge variant="premium" className="w-fit px-3 py-1.5 text-sm">
            <SlidersHorizontal className="mr-1 h-4 w-4" aria-hidden="true" />
            Rule-based scoring
          </Badge>
        </div>

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {locationError ? (
          <AlertMessage variant="warning">{locationError}</AlertMessage>
        ) : null}

        <form
          onSubmit={onRecommend}
          aria-label="Recommendation form"
          className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-neutral-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                Preference builder
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
                Each supported field contributes to the existing match score. More
                filled preferences give the ranking model stronger signals.
              </p>
            </div>
            <Badge variant="info" className="w-fit">
              Approved rentals only
            </Badge>
          </div>

          <section
            aria-label="Recommendation metrics"
            className="mt-5 grid gap-3 md:grid-cols-3"
          >
            {[
              {
                label: "Preferences set",
                value: activePreferenceCount,
                icon: <Target className="h-5 w-5" aria-hidden="true" />,
              },
              {
                label: "Matches found",
                value: recommendations.length,
                icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
              },
              {
                label: "Top score",
                value: topScore === null ? "N/A" : `${topScore}%`,
                icon: <Star className="h-5 w-5" aria-hidden="true" />,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
              >
                <div className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-600">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-950">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="Preferred city" htmlFor="city">
              <Input
                id="city"
                type="text"
                value={preferences.city}
                onChange={(event) => onPreferenceChange("city", event.target.value)}
                placeholder="e.g. Cagayan de Oro"
                className="h-12 text-base"
              />
            </FormField>

            <FormField label="Property type" htmlFor="propertyType">
              <Input
                id="propertyType"
                type="text"
                value={preferences.propertyType}
                onChange={(event) =>
                  onPreferenceChange("propertyType", event.target.value)
                }
                placeholder="Apartment, studio, house"
                className="h-12 text-base"
              />
            </FormField>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Budget range (PHP)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="minBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preferences.minBudget}
                  onChange={(event) =>
                    onPreferenceChange("minBudget", event.target.value)
                  }
                  placeholder="Min PHP"
                  className="h-12 text-base"
                />
                <Input
                  id="maxBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preferences.maxBudget}
                  onChange={(event) =>
                    onPreferenceChange("maxBudget", event.target.value)
                  }
                  placeholder="Max PHP"
                  className="h-12 text-base"
                />
              </div>
            </div>

            <FormField
              label="Bedrooms"
              htmlFor="bedrooms-disabled"
              description="Bedroom weighting is not part of the current scoring model."
            >
              <Input
                id="bedrooms-disabled"
                value="Any"
                readOnly
                disabled
                className="h-12 text-base"
              />
            </FormField>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-medium text-neutral-700">
              Must-have amenities
            </p>
            {amenities.length === 0 ? (
              <EmptyState
                title="No amenities available"
                description="Amenities added to the marketplace will appear as selectable matching signals."
                icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                className="p-6"
              />
            ) : (
              <fieldset>
                <legend className="sr-only">Selected amenities</legend>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((amenity) => {
                    const selected = preferences.amenityIds.includes(amenity.id);

                    return (
                      <label
                        key={amenity.id}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                          selected
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => toggleAmenity(amenity.id)}
                        />
                        {selected ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {amenity.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <p className="mb-3 text-sm font-medium text-neutral-700">
              Location radius optional
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_180px]">
              <Input
                id="preferredLat"
                type="number"
                step="any"
                value={preferences.preferredLat}
                onChange={(event) =>
                  onPreferenceChange("preferredLat", event.target.value)
                }
                placeholder="Latitude"
                className="h-12 text-base"
              />
              <Input
                id="preferredLng"
                type="number"
                step="any"
                value={preferences.preferredLng}
                onChange={(event) =>
                  onPreferenceChange("preferredLng", event.target.value)
                }
                placeholder="Longitude"
                className="h-12 text-base"
              />
              <Input
                id="maxDistanceKm"
                type="number"
                min="0"
                step="0.1"
                value={preferences.maxDistanceKm}
                onChange={(event) =>
                  onPreferenceChange("maxDistanceKm", event.target.value)
                }
                placeholder="Km"
                className="h-12 text-base"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={onUseLocation}
                className="h-12"
              >
                <Crosshair className="h-4 w-4" aria-hidden="true" />
                Use my location
              </Button>
            </div>
          </div>

          {recommendationError ? (
            <AlertMessage variant="danger" className="mt-5">
              {recommendationError}
            </AlertMessage>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClearResults}
              disabled={isGenerating}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {isGenerating ? "Ranking..." : "Rank rentals"}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-violet-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Scoring on:</p>
            <div className="mt-1 flex flex-wrap gap-2 text-sm font-semibold">
              {preferenceSummary.length === 0 ? (
                <span className="text-violet-700">No preferences selected yet</span>
              ) : (
                preferenceSummary.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className="rounded-full bg-white/70 px-2.5 py-1"
                  >
                    {item}
                  </span>
                ))
              )}
            </div>
          </div>
          <Badge variant="premium" className="bg-white">
            {hasSearched ? "Latest ranking ready" : "Ready to rank"}
          </Badge>
        </div>

        <section aria-label="Ranked recommendation results" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                Top matches
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                Ranked by fit score. Higher means more selected preferences matched.
              </p>
            </div>
            <Badge variant="success">Approved only</Badge>
          </div>

          {isGenerating ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              title={
                hasSearched
                  ? "No approved rentals matched your preferences"
                  : "Ranked rentals will appear here"
              }
              description={
                hasSearched
                  ? "Try widening the budget, removing an amenity, or using a broader location."
                  : "Set preferences above, review the summary, then rank approved rentals."
              }
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              className="py-10"
            />
          ) : (
            <div className="space-y-3">
              {recommendations.map((item) => {
                const { property, reasons, missing, scorePercent } = item;
                const amenityNames = (property.property_amenities ?? [])
                  .map((amenity) => amenity.amenities?.name)
                  .filter((name): name is string => Boolean(name));
                const description = property.description?.trim();

                return (
                  <article
                    key={property.id}
                    className="grid overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300 md:grid-cols-[180px_minmax(0,1fr)_170px]"
                  >
                    <div className="md:min-h-0">
                      {(() => {
                        const cover = property.property_images?.find((img) => img.is_cover) ?? property.property_images?.[0];
                        return cover?.storage_path ? (
                          <img src={cover.storage_path} alt={property.title} className="aspect-[4/3] h-full w-full object-cover md:aspect-auto" />
                        ) : (
                          <div className="flex min-h-36 items-center justify-center bg-[#e1f4ed] text-emerald-600 md:min-h-0">
                            <Building2 className="h-10 w-10" aria-hidden="true" />
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="line-clamp-1 text-lg font-semibold text-neutral-950">
                          {property.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">
                            {formatLocation(property) || "Location unavailable"}
                          </span>
                        </p>
                        {description ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-600">
                            {description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {amenityNames.length === 0 ? (
                          <Badge>No amenities listed</Badge>
                        ) : (
                          amenityNames.slice(0, 4).map((amenity) => (
                            <Badge key={amenity}>{amenity}</Badge>
                          ))
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {reasons.slice(0, 4).map((reason) => (
                          <Badge key={reason} variant="success">
                            <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                            {reason}
                          </Badge>
                        ))}
                      </div>
                      {missing.length > 0 ? (
                        <p className="text-xs text-neutral-500">
                          Tradeoff: {missing[0]}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-row items-center justify-between gap-4 border-t border-neutral-100 p-4 md:flex-col md:items-end md:justify-center md:border-l md:border-t-0">
                      <div className="text-left md:text-right">
                        <p className="text-lg font-semibold text-violet-700">
                          {formatPrice(property.price)}
                        </p>
                        <p className="text-xs font-semibold uppercase text-neutral-400">
                          Match score
                        </p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-600">
                          {scorePercent}%
                        </p>
                      </div>
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
