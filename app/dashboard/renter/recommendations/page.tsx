"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  Bot,
  Building2,
  Check,
  Crosshair,
  Home,
  Loader2,
  Map,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Target,
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
import { FilterPanel } from "@/app/components/ui/filter-panel";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
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
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
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
      className="pb-10"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Smart ranked matching"
          title="Find your strongest rental matches"
          description="Set your budget, location, property type, and amenities to rank approved rentals by fit."
          actions={
            <Badge variant="premium" className="px-3 py-1">
              Rule-based scoring
            </Badge>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {locationError ? (
          <AlertMessage variant="warning">{locationError}</AlertMessage>
        ) : null}

        <section aria-label="Recommendation results" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                Top matches
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                Ranked approved rentals based on your current preferences.
              </p>
            </div>
            <Badge variant="success">Approved only</Badge>
          </div>

          {recommendationError ? (
            <AlertMessage variant="danger">{recommendationError}</AlertMessage>
          ) : null}

          {isGenerating ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              title={
                hasSearched
                  ? "No approved rentals matched your preferences"
                  : "Top rentals will appear here"
              }
              description={
                hasSearched
                  ? "Try widening the budget, removing an amenity, or using a broader location."
                  : "Set a few preferences below to generate a ranked marketplace view."
              }
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              className="py-10"
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {recommendations.map((item, index) => {
                const { property, reasons, missing, scorePercent } = item;
                const amenityNames = (property.property_amenities ?? [])
                  .map((amenity) => amenity.amenities?.name)
                  .filter((name): name is string => Boolean(name));

                return (
                  <article
                    key={property.id}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
                  >
                    <div className="relative flex aspect-[4/3] items-end justify-between bg-[linear-gradient(135deg,#f7f7f5,#e7e5e4)] p-4">
                      <div>
                        <Badge variant="premium">#{index + 1} match</Badge>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
                          {formatPrice(property.price)}
                        </p>
                      </div>
                      <div className="rounded-md bg-white/90 px-3 py-2 text-center shadow-sm ring-1 ring-black/5">
                        <p className="text-lg font-semibold text-neutral-950">
                          {scorePercent}%
                        </p>
                        <p className="text-xs text-neutral-500">fit</p>
                      </div>
                    </div>
                    <div className="space-y-4 p-4">
                      <div>
                        <h3 className="line-clamp-1 text-base font-semibold text-neutral-950">
                          {property.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">
                            {formatLocation(property) || "Location unavailable"}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
                        <span className="inline-flex items-center gap-1.5">
                          <BedDouble className="h-4 w-4" aria-hidden="true" />
                          {property.bedrooms} bed
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Bath className="h-4 w-4" aria-hidden="true" />
                          {property.bathrooms} bath
                        </span>
                        <span>{property.area_sqm} sqm</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge>{property.property_type || "Rental"}</Badge>
                        {amenityNames.slice(0, 2).map((amenity) => (
                          <Badge key={amenity}>{amenity}</Badge>
                        ))}
                        {amenityNames.length > 2 ? (
                          <Badge>+{amenityNames.length - 2}</Badge>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4 text-sm">
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Deposit
                          </p>
                          <p className="mt-1 font-medium text-neutral-800">
                            {property.deposit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Available
                          </p>
                          <p className="mt-1 font-medium text-neutral-800">
                            {formatDate(property.available_from)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-neutral-100 pt-4">
                        <div className="flex flex-wrap gap-2">
                          {reasons.slice(0, 2).map((reason) => (
                            <Badge key={reason} variant="success">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                        {missing.length > 0 ? (
                          <p className="line-clamp-1 text-xs text-neutral-500">
                            Tradeoff: {missing[0]}
                          </p>
                        ) : (
                          <p className="text-xs text-green-700">No major gaps</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <form onSubmit={onRecommend} aria-label="Recommendation form">
          <FilterPanel
            title="Preference builder"
            description="Each field contributes to the ranked matching model already used by this page."
            actions={
              <>
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isGenerating ? "Ranking..." : "Rank rentals"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClearResults}
                  disabled={isGenerating}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Clear results
                </Button>
              </>
            }
          >
            <FormField label="Preferred city" htmlFor="city">
              <Input
                id="city"
                type="text"
                value={preferences.city}
                onChange={(event) => onPreferenceChange("city", event.target.value)}
                placeholder="Any city"
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
              />
            </FormField>
            <FormField label="Minimum budget" htmlFor="minBudget">
              <Input
                id="minBudget"
                type="number"
                min="0"
                step="0.01"
                value={preferences.minBudget}
                onChange={(event) =>
                  onPreferenceChange("minBudget", event.target.value)
                }
                placeholder="0"
              />
            </FormField>
            <FormField label="Maximum budget" htmlFor="maxBudget">
              <Input
                id="maxBudget"
                type="number"
                min="0"
                step="0.01"
                value={preferences.maxBudget}
                onChange={(event) =>
                  onPreferenceChange("maxBudget", event.target.value)
                }
                placeholder="No limit"
              />
            </FormField>
          </FilterPanel>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Desired amenities</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  Select must-have features to influence the amenity portion of
                  the match score.
                </p>
              </CardHeader>
              <CardContent>
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
                                ? "border-neutral-950 bg-neutral-950 text-white"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location radius</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  Add coordinates when distance matters more than city name.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Preferred latitude" htmlFor="preferredLat">
                  <Input
                    id="preferredLat"
                    type="number"
                    step="any"
                    value={preferences.preferredLat}
                    onChange={(event) =>
                      onPreferenceChange("preferredLat", event.target.value)
                    }
                    placeholder="Latitude"
                  />
                </FormField>
                <FormField label="Preferred longitude" htmlFor="preferredLng">
                  <Input
                    id="preferredLng"
                    type="number"
                    step="any"
                    value={preferences.preferredLng}
                    onChange={(event) =>
                      onPreferenceChange("preferredLng", event.target.value)
                    }
                    placeholder="Longitude"
                  />
                </FormField>
                <FormField label="Max distance (km)" htmlFor="maxDistanceKm">
                  <Input
                    id="maxDistanceKm"
                    type="number"
                    min="0"
                    step="0.1"
                    value={preferences.maxDistanceKm}
                    onChange={(event) =>
                      onPreferenceChange("maxDistanceKm", event.target.value)
                    }
                    placeholder="Any distance"
                  />
                </FormField>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onUseLocation}
                  className="w-full"
                >
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                  Use my location
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>

        <section
          aria-label="Scoring explanation"
          className="grid gap-3 md:grid-cols-3"
        >
          {[
            {
              label: "Preferences",
              value: activePreferenceCount,
              icon: <Target className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Matches",
              value: recommendations.length,
              icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Top score",
              value: topScore === null ? "N/A" : `${topScore}%`,
              icon: <Star className="h-4 w-4" aria-hidden="true" />,
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

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-950">
                Preference summary
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Selected amenities: {selectedAmenityNames.join(", ") || "None"}
              </p>
            </div>
            <Badge variant="info">
              {hasSearched ? "Latest ranking ready" : "Ready to rank"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
