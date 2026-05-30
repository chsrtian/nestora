"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Compass,
  Home,
  Loader2,
  Map,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import { PageHeader } from "@/app/components/layout/page-header";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FilterPanel } from "@/app/components/ui/filter-panel";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/input";
import { PropertyCard } from "@/app/components/ui/property-card";
import { PropertyCardSkeleton, Skeleton } from "@/app/components/ui/skeleton";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
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
  landlord_id: string;
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
  created_at: string;
  property_amenities?: PropertyAmenity[] | null;
};

type EmbeddedOne<T> = T | T[] | null;

type PropertyAmenityRow = Omit<PropertyAmenity, "amenities"> & {
  amenities: EmbeddedOne<PropertyAmenity["amenities"]>;
};

type PropertyRow = Omit<Property, "property_amenities"> & {
  property_amenities?: PropertyAmenityRow[] | null;
};

type Inquiry = {
  id: string;
  property_id: string;
  renter_id: string;
  landlord_id: string;
  message: string;
  created_at: string;
};

type Review = {
  id: string;
  property_id: string;
  renter_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type Filters = {
  search: string;
  city: string;
  propertyType: string;
  minPrice: string;
  maxPrice: string;
  amenityId: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  city: "",
  propertyType: "",
  minPrice: "",
  maxPrice: "",
  amenityId: "",
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

const groupByPropertyId = <T extends { property_id: string }>(items: T[]) => {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    if (!acc[item.property_id]) {
      acc[item.property_id] = [];
    }
    acc[item.property_id].push(item);
    return acc;
  }, {});
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

export default function RenterDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyInquiries, setPropertyInquiries] = useState<Record<string, Inquiry[]>>({});
  const [propertyReviews, setPropertyReviews] = useState<Record<string, Review[]>>({});
  const [inquiryMessages, setInquiryMessages] = useState<Record<string, string>>({});
  const [inquirySending, setInquirySending] = useState<Record<string, boolean>>({});
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({});
  const [inquirySuccess, setInquirySuccess] = useState<Record<string, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { rating: string; comment: string }>
  >({});
  const [reviewSending, setReviewSending] = useState<Record<string, boolean>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [reviewSuccess, setReviewSuccess] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const fetchProperties = async (
    client: SupabaseClient,
    activeFilters: Filters,
  ): Promise<Property[]> => {
    setSearchLoading(true);
    setSearchError(null);

    const trimmedSearch = activeFilters.search.trim();
    const safeSearch = trimmedSearch.replace(/[%_]/g, "\\$&");
    const trimmedCity = activeFilters.city.trim();
    const trimmedType = activeFilters.propertyType.trim();
    const minPrice = Number(activeFilters.minPrice);
    const maxPrice = Number(activeFilters.maxPrice);

    let query = client
      .from("properties")
      .select(
        "id, landlord_id, title, description, property_type, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, created_at, property_amenities(amenity_id, amenities(name))",
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (safeSearch) {
      query = query.or(
        `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,address_line.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%`,
      );
    }

    if (trimmedCity) {
      query = query.ilike("city", `%${trimmedCity}%`);
    }

    if (trimmedType) {
      query = query.ilike("property_type", `%${trimmedType}%`);
    }

    if (!Number.isNaN(minPrice) && activeFilters.minPrice !== "") {
      query = query.gte("price", minPrice);
    }

    if (!Number.isNaN(maxPrice) && activeFilters.maxPrice !== "") {
      query = query.lte("price", maxPrice);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setSearchError(queryError.message);
      setProperties([]);
      setSearchLoading(false);
      return [];
    }

    const nextProperties = normalizeProperties((data ?? []) as PropertyRow[]);
    const filteredProperties = activeFilters.amenityId
      ? nextProperties.filter((property) =>
          (property.property_amenities ?? []).some(
            (amenity) => amenity.amenity_id === activeFilters.amenityId,
          ),
        )
      : nextProperties;

    setProperties(filteredProperties);
    setSearchLoading(false);
    return filteredProperties;
  };

  const loadInquiryAndReviewData = async (
    client: SupabaseClient,
    propertyList: Property[],
    userId: string,
  ) => {
    setListError(null);

    if (propertyList.length === 0) {
      setPropertyInquiries({});
      setPropertyReviews({});
      return;
    }

    const propertyIds = propertyList.map((property) => property.id);

    const [{ data: inquiriesData, error: inquiriesError }, { data: reviewsData, error: reviewsError }]
      = await Promise.all([
        client
          .from("inquiries")
          .select("id, property_id, renter_id, landlord_id, message, created_at")
          .eq("renter_id", userId)
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false }),
        client
          .from("reviews")
          .select("id, property_id, renter_id, rating, comment, created_at")
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false }),
      ]);

    if (inquiriesError) {
      setListError(inquiriesError.message);
      setPropertyInquiries({});
    } else {
      setPropertyInquiries(groupByPropertyId((inquiriesData ?? []) as Inquiry[]));
    }

    if (reviewsError) {
      setListError(reviewsError.message);
      setPropertyReviews({});
    } else {
      setPropertyReviews(groupByPropertyId((reviewsData ?? []) as Review[]));
    }
  };

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
      const list = await fetchProperties(client, DEFAULT_FILTERS);
      await loadInquiryAndReviewData(client, list, sessionData.session.user.id);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const onFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const onSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minValue = Number(filters.minPrice);
    const maxValue = Number(filters.maxPrice);
    if (
      filters.minPrice !== "" &&
      filters.maxPrice !== "" &&
      !Number.isNaN(minValue) &&
      !Number.isNaN(maxValue) &&
      minValue > maxValue
    ) {
      setSearchError("Minimum price cannot be greater than maximum price.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSearchError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    const list = await fetchProperties(client, filters);
    if (renterId) {
      const clientWithAuth = getSupabaseClient();
      if (clientWithAuth) {
        await loadInquiryAndReviewData(clientWithAuth, list, renterId);
      }
    }
  };

  const onClearFilters = async () => {
    const client = getSupabaseClient();
    setFilters(DEFAULT_FILTERS);
    if (!client) {
      setSearchError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    const list = await fetchProperties(client, DEFAULT_FILTERS);
    if (renterId) {
      await loadInquiryAndReviewData(client, list, renterId);
    }
  };

  const onInquiryMessageChange = (propertyId: string, value: string) => {
    setInquiryMessages((prev) => ({ ...prev, [propertyId]: value }));
  };

  const onReviewDraftChange = (
    propertyId: string,
    field: "rating" | "comment",
    value: string,
  ) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [propertyId]: {
        rating: prev[propertyId]?.rating ?? "",
        comment: prev[propertyId]?.comment ?? "",
        [field]: value,
      },
    }));
  };

  const verifyApprovedProperty = async (
    client: SupabaseClient,
    propertyId: string,
  ) => {
    const { data, error } = await client
      .from("properties")
      .select("id, status, landlord_id")
      .eq("id", propertyId)
      .maybeSingle();

    if (error || !data) {
      return {
        error: error?.message ?? "Unable to verify property availability.",
      };
    }

    if (data.status !== "approved") {
      return {
        error: "This property is no longer available for inquiry or review.",
      };
    }

    return { landlordId: data.landlord_id as string };
  };

  const onSendInquiry = async (property: Property) => {
    if (!renterId) {
      setInquiryErrors((prev) => ({
        ...prev,
        [property.id]: "You must be signed in to send inquiries.",
      }));
      return;
    }

    const message = (inquiryMessages[property.id] ?? "").trim();
    if (!message) {
      setInquiryErrors((prev) => ({
        ...prev,
        [property.id]: "Please enter a message for the landlord.",
      }));
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setInquiryErrors((prev) => ({
        ...prev,
        [property.id]: supabaseConfigError ?? "Supabase is not configured.",
      }));
      return;
    }

    const propertyCheck = await verifyApprovedProperty(client, property.id);
    if ("error" in propertyCheck) {
      const checkError =
        propertyCheck.error ?? "Unable to verify property availability.";
      setInquiryErrors((prev) => ({
        ...prev,
        [property.id]: checkError,
      }));
      setInquirySuccess((prev) => ({ ...prev, [property.id]: "" }));
      return;
    }

    setInquirySending((prev) => ({ ...prev, [property.id]: true }));
    setInquiryErrors((prev) => ({ ...prev, [property.id]: "" }));
    setInquirySuccess((prev) => ({ ...prev, [property.id]: "" }));

    const { error: insertError } = await client.from("inquiries").insert({
      property_id: property.id,
      renter_id: renterId,
      landlord_id: propertyCheck.landlordId,
      message,
    });

    if (insertError) {
      setInquiryErrors((prev) => ({
        ...prev,
        [property.id]: insertError.message,
      }));
      setInquirySending((prev) => ({ ...prev, [property.id]: false }));
      return;
    }

    const newInquiry: Inquiry = {
      id: `${property.id}-${Date.now()}`,
      property_id: property.id,
      renter_id: renterId,
      landlord_id: propertyCheck.landlordId,
      message,
      created_at: new Date().toISOString(),
    };

    setPropertyInquiries((prev) => ({
      ...prev,
      [property.id]: [newInquiry, ...(prev[property.id] ?? [])],
    }));
    setInquiryMessages((prev) => ({ ...prev, [property.id]: "" }));
    setInquirySuccess((prev) => ({
      ...prev,
      [property.id]: "Inquiry sent to the landlord.",
    }));
    setInquirySending((prev) => ({ ...prev, [property.id]: false }));
  };

  const onSubmitReview = async (property: Property) => {
    if (!renterId) {
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]: "You must be signed in to submit a review.",
      }));
      return;
    }

    const hasInquiry = (propertyInquiries[property.id] ?? []).length > 0;
    if (!hasInquiry) {
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]:
          "Send an inquiry for this property first before leaving a review.",
      }));
      return;
    }

    const draft = reviewDrafts[property.id] ?? { rating: "", comment: "" };
    const ratingValue = Number(draft.rating);
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]: "Rating must be a whole number from 1 to 5.",
      }));
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]: supabaseConfigError ?? "Supabase is not configured.",
      }));
      return;
    }

    const propertyCheck = await verifyApprovedProperty(client, property.id);
    if ("error" in propertyCheck) {
      const checkError =
        propertyCheck.error ?? "Unable to verify property availability.";
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]: checkError,
      }));
      setReviewSuccess((prev) => ({ ...prev, [property.id]: "" }));
      return;
    }

    setReviewSending((prev) => ({ ...prev, [property.id]: true }));
    setReviewErrors((prev) => ({ ...prev, [property.id]: "" }));
    setReviewSuccess((prev) => ({ ...prev, [property.id]: "" }));

    const comment = draft.comment.trim();

    const { error: insertError } = await client.from("reviews").insert({
      property_id: property.id,
      renter_id: renterId,
      landlord_id: propertyCheck.landlordId,
      rating: ratingValue,
      comment: comment ? comment : null,
    });

    if (insertError) {
      setReviewErrors((prev) => ({
        ...prev,
        [property.id]: insertError.message,
      }));
      setReviewSending((prev) => ({ ...prev, [property.id]: false }));
      return;
    }

    const newReview: Review = {
      id: `${property.id}-${Date.now()}`,
      property_id: property.id,
      renter_id: renterId,
      rating: ratingValue,
      comment: comment ? comment : null,
      created_at: new Date().toISOString(),
    };

    setPropertyReviews((prev) => ({
      ...prev,
      [property.id]: [newReview, ...(prev[property.id] ?? [])],
    }));
    setReviewDrafts((prev) => ({
      ...prev,
      [property.id]: { rating: "", comment: "" },
    }));
    setReviewSuccess((prev) => ({
      ...prev,
      [property.id]: "Review submitted.",
    }));
    setReviewSending((prev) => ({ ...prev, [property.id]: false }));
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Rental Marketplace">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
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
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="Renter marketplace"
          title="Browse approved rentals"
          description="Search reviewed listings, compare property details, send inquiries, and leave reviews after contact."
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/dashboard/renter/map")}
              >
                <Map className="h-4 w-4" aria-hidden="true" />
                Map
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/dashboard/renter/recommendations")}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Matches
              </Button>
              <Button
                type="button"
                onClick={() => router.push("/dashboard/renter/assistant")}
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                AI Assistant
              </Button>
            </>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        <form onSubmit={onSearch} aria-label="Property search">
          <FilterPanel
            title="Search approved rentals"
            description="Filter by location, type, budget, and amenities."
            actions={
              <>
                <Button type="submit" disabled={searchLoading}>
                  {searchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  {searchLoading ? "Searching..." : "Search"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClearFilters}
                  disabled={searchLoading}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Clear
                </Button>
              </>
            }
          >
            <FormField label="Search" htmlFor="search">
              <Input
                id="search"
                type="text"
                value={filters.search}
                onChange={(event) => onFilterChange("search", event.target.value)}
                placeholder="Title, description, address, or city"
              />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input
                id="city"
                type="text"
                value={filters.city}
                onChange={(event) => onFilterChange("city", event.target.value)}
                placeholder="Any city"
              />
            </FormField>
            <FormField label="Property type" htmlFor="propertyType">
              <Input
                id="propertyType"
                type="text"
                value={filters.propertyType}
                onChange={(event) =>
                  onFilterChange("propertyType", event.target.value)
                }
                placeholder="Apartment, condo, studio"
              />
            </FormField>
            <FormField label="Amenity" htmlFor="amenity">
              <Select
                id="amenity"
                value={filters.amenityId}
                onChange={(event) => onFilterChange("amenityId", event.target.value)}
              >
                <option value="">Any amenity</option>
                {amenities.map((amenity) => (
                  <option key={amenity.id} value={amenity.id}>
                    {amenity.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Min price" htmlFor="minPrice">
              <Input
                id="minPrice"
                type="number"
                min="0"
                step="0.01"
                value={filters.minPrice}
                onChange={(event) => onFilterChange("minPrice", event.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Max price" htmlFor="maxPrice">
              <Input
                id="maxPrice"
                type="number"
                min="0"
                step="0.01"
                value={filters.maxPrice}
                onChange={(event) => onFilterChange("maxPrice", event.target.value)}
                placeholder="No limit"
              />
            </FormField>
          </FilterPanel>
        </form>

        <section aria-label="Approved properties" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                Approved rentals
              </h2>
              <p className="text-sm leading-6 text-neutral-500">
                Marketplace listings reviewed for renter visibility.
              </p>
            </div>
            <Badge variant="success">Approved only</Badge>
          </div>

          {searchError ? <AlertMessage variant="danger">{searchError}</AlertMessage> : null}
          {listError ? <AlertMessage variant="danger">{listError}</AlertMessage> : null}

          {searchLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PropertyCardSkeleton />
              <PropertyCardSkeleton />
            </div>
          ) : properties.length === 0 ? (
            <EmptyState
              title="No approved rentals match your filters"
              description="Try widening your city, budget, property type, or amenity filters."
              icon={<Compass className="h-5 w-5" aria-hidden="true" />}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClearFilters}
                  disabled={searchLoading}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {properties.map((property) => {
                const description = property.description?.trim();
                const preview = description
                  ? description.slice(0, 160)
                  : "No description provided.";
                const amenityNames = (property.property_amenities ?? [])
                  .map((item) => item.amenities?.name)
                  .filter((name): name is string => Boolean(name));

                const inquiriesForProperty =
                  propertyInquiries[property.id] ?? [];
                const reviewsForProperty = propertyReviews[property.id] ?? [];
                const hasInquiry = inquiriesForProperty.length > 0;
                const inquiryDraft = inquiryMessages[property.id] ?? "";
                const reviewDraft = reviewDrafts[property.id] ?? {
                  rating: "",
                  comment: "",
                };

                return (
                  <PropertyCard
                    key={property.id}
                    title={property.title}
                    city={property.city}
                    address={[property.state, property.country]
                      .filter(Boolean)
                      .join(", ")}
                    propertyType={property.property_type || "Not specified"}
                    monthlyRent={property.price}
                    bedrooms={property.bedrooms}
                    bathrooms={property.bathrooms}
                    amenities={amenityNames}
                    description={preview}
                    status="approved"
                    meta={
                      <div className="grid grid-cols-2 gap-3">
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
                            Advance
                          </p>
                          <p className="mt-1 font-medium text-neutral-800">
                            {property.advance}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Area
                          </p>
                          <p className="mt-1 font-medium text-neutral-800">
                            {property.area_sqm} sqm
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Available
                          </p>
                          <p className="mt-1 font-medium text-neutral-800">
                            {property.available_from
                              ? new Date(property.available_from).toLocaleDateString()
                              : "Not set"}
                          </p>
                        </div>
                      </div>
                    }
                    actions={
                      <div className="w-full space-y-5">
                        <section aria-label="Inquiry" className="space-y-3">
                          <div>
                            <h3 className="text-sm font-semibold text-neutral-950">
                              Send an inquiry
                            </h3>
                            <p className="text-sm leading-6 text-neutral-500">
                              Ask about availability, lease terms, or viewing times.
                            </p>
                          </div>
                          {inquiryErrors[property.id] ? (
                            <AlertMessage variant="danger">
                              {inquiryErrors[property.id]}
                            </AlertMessage>
                          ) : null}
                          {inquirySuccess[property.id] ? (
                            <AlertMessage variant="success">
                              {inquirySuccess[property.id]}
                            </AlertMessage>
                          ) : null}
                          <FormField label="Message" htmlFor={`inquiry-${property.id}`}>
                            <Textarea
                              id={`inquiry-${property.id}`}
                              value={inquiryDraft}
                              onChange={(event) =>
                                onInquiryMessageChange(
                                  property.id,
                                  event.target.value,
                                )
                              }
                              rows={3}
                              placeholder="Ask about availability, lease terms, or schedule a viewing."
                            />
                          </FormField>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onSendInquiry(property)}
                            disabled={Boolean(inquirySending[property.id])}
                            className="w-full"
                          >
                            {inquirySending[property.id] ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <MessageSquare
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            {inquirySending[property.id]
                              ? "Sending inquiry..."
                              : "Send inquiry"}
                          </Button>
                        </section>

                        <section
                          aria-label="Reviews"
                          className="space-y-3 border-t border-neutral-100 pt-5"
                        >
                          <div>
                            <h3 className="text-sm font-semibold text-neutral-950">
                              Reviews
                            </h3>
                            <p className="text-sm leading-6 text-neutral-500">
                              You can review this listing after sending an inquiry.
                            </p>
                          </div>
                          {!hasInquiry ? (
                            <AlertMessage variant="info">
                              Send an inquiry for this property first before leaving
                              a review.
                            </AlertMessage>
                          ) : null}
                          {reviewErrors[property.id] ? (
                            <AlertMessage variant="danger">
                              {reviewErrors[property.id]}
                            </AlertMessage>
                          ) : null}
                          {reviewSuccess[property.id] ? (
                            <AlertMessage variant="success">
                              {reviewSuccess[property.id]}
                            </AlertMessage>
                          ) : null}
                          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                            <FormField label="Rating" htmlFor={`rating-${property.id}`}>
                              <Select
                                id={`rating-${property.id}`}
                                value={reviewDraft.rating}
                                onChange={(event) =>
                                  onReviewDraftChange(
                                    property.id,
                                    "rating",
                                    event.target.value,
                                  )
                                }
                                disabled={!hasInquiry}
                              >
                                <option value="">Select</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                              </Select>
                            </FormField>
                            <FormField label="Comment" htmlFor={`comment-${property.id}`}>
                              <Textarea
                                id={`comment-${property.id}`}
                                value={reviewDraft.comment}
                                onChange={(event) =>
                                  onReviewDraftChange(
                                    property.id,
                                    "comment",
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                placeholder="Share your experience (optional)."
                                disabled={!hasInquiry}
                              />
                            </FormField>
                          </div>
                          <Button
                            type="button"
                            onClick={() => onSubmitReview(property)}
                            disabled={
                              !hasInquiry || Boolean(reviewSending[property.id])
                            }
                            className="w-full"
                          >
                            {reviewSending[property.id] ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Star className="h-4 w-4" aria-hidden="true" />
                            )}
                            {reviewSending[property.id]
                              ? "Submitting review..."
                              : "Submit review"}
                          </Button>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-neutral-900">
                              Recent reviews
                            </p>
                            {reviewsForProperty.length === 0 ? (
                              <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                                No reviews yet.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {reviewsForProperty.map((review) => (
                                  <li
                                    key={review.id}
                                    className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium text-neutral-950">
                                        {review.rating}/5
                                      </span>
                                      <span className="text-xs text-neutral-500">
                                        {new Date(
                                          review.created_at,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {review.comment ? (
                                      <p className="mt-2 leading-6 text-neutral-600">
                                        {review.comment}
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </section>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Marketplace summary" className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Approved rentals",
              value: properties.length,
              icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Your inquiries",
              value: Object.values(propertyInquiries).reduce(
                (total, items) => total + items.length,
                0,
              ),
              icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Reviewed",
              value: Object.values(propertyReviews).filter(
                (items) => items.length > 0,
              ).length,
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
      </div>
    </AppShell>
  );
}
