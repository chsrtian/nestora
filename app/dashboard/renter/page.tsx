"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Bath,
  BedDouble,
  Bot,
  Building2,
  Check,
  Home,
  Heart,
  LayoutGrid,
  List,
  Loader2,
  Map,
  MapPin,
  MessageSquare,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { formatMonthlyRentInPHP, formatPriceInPHP } from "@/lib/currency";
import { toggleFavorite } from "@/lib/favorites";

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
  price: number | null;
  deposit: number | null;
  advance: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  verification_status: "verified" | "needs_verification" | "incomplete" | null;
  source_note: string | null;
  available_from: string | null;
  created_at: string;
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

type SortMode = "newest" | "price_asc" | "price_desc" | "title_asc";

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
  {
    href: "/dashboard/renter/saved",
    label: "Saved",
    icon: Heart,
  },
  {
    href: "/dashboard/renter/inquiries",
    label: "My inquiries",
    icon: MessageSquare,
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
    property_images: property.property_images ?? null,
  }));
}

function formatRent(value: number | null) {
  if (value === null) return "Not listed";
  return formatMonthlyRentInPHP(value);
}

function formatPrice(value: number | null) {
  if (value === null) return "Not listed";
  return formatPriceInPHP(value);
}

function formatCount(value: number | null, unit: string) {
  return typeof value === "number" ? `${value} ${unit}` : "Not listed";
}

function formatVerificationStatus(
  status: Property["verification_status"],
) {
  if (status === "verified") return "Source verified";
  if (status === "needs_verification") return "Needs verification";
  if (status === "incomplete") return "Incomplete";
  return "Needs verification";
}

function formatLocation(property: Property) {
  return [property.city, property.state, property.country].filter(Boolean).join(", ");
}

function isNewListing(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const daysOld = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return daysOld <= 14;
}

function listingVisualClasses(index: number) {
  const styles = [
    {
      image: "bg-[#dedbd1]",
      icon: "text-neutral-500",
      badge: "success" as const,
    },
    {
      image: "bg-[#e3f5ee]",
      icon: "text-emerald-600",
      badge: "info" as const,
    },
    {
      image: "bg-[#fff1da]",
      icon: "text-amber-700",
      badge: "warning" as const,
    },
    {
      image: "bg-[#e7e5dc]",
      icon: "text-neutral-500",
      badge: "premium" as const,
    },
  ];

  return styles[index % styles.length];
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
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [favoritesSending, setFavoritesSending] = useState<Record<string, boolean>>({});
  const [contactPropertyId, setContactPropertyId] = useState<string | null>(null);

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
        "id, landlord_id, title, description, property_type, city, state, country, price, deposit, advance, bedrooms, bathrooms, area_sqm, available_from, created_at, verification_status, source_note, property_images(storage_path, is_cover), property_amenities(amenity_id, amenities(name))",
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

  const onToggleFavorite = async (property: Property) => {
    if (!renterId) {
      setListError("You must be signed in to save rentals.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setListError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setFavoritesSending((prev) => ({ ...prev, [property.id]: true }));

    const result = await toggleFavorite(client, property.id, renterId);
    if (!result.success) {
      setListError(result.error ?? "Failed to update favorite status.");
      setFavoritesSending((prev) => ({ ...prev, [property.id]: false }));
      return;
    }

    setFavorites((prev) => ({
      ...prev,
      [property.id]: result.isFavorite ?? false,
    }));
    setFavoritesSending((prev) => ({ ...prev, [property.id]: false }));
  };

const sortedProperties = useMemo(() => {
    const list = [...properties];

    if (sortMode === "price_asc") {
      return list.sort(
        (a, b) =>
          (a.price ?? Number.POSITIVE_INFINITY) -
          (b.price ?? Number.POSITIVE_INFINITY),
      );
    }

    if (sortMode === "price_desc") {
      return list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    }

    if (sortMode === "title_asc") {
      return list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [properties, sortMode]);

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Nestora">
        <div className="mx-auto max-w-[1800px] space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="hidden h-[420px] w-full 2xl:block" />
          </div>
        </div>
      </AppShell>
   );
  }

  const contactProperty = contactPropertyId
    ? sortedProperties.find((item) => item.id === contactPropertyId) ?? null
    : null;

  return (
    <AppShell
      navItems={renterNavItems}
      title="Nestora"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="px-3 py-3 pb-5 sm:px-4 lg:px-6"
    >
      <div className="mx-auto max-w-[1800px] space-y-4">
        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        <form onSubmit={onSearch} aria-label="Property search" className="space-y-4">
          {/* First row: search input, search button, map view button */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_auto_auto]">
              <label htmlFor="search" className="sr-only">
                Search rentals
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  id="search"
                  type="text"
                  value={filters.search}
                  onChange={(event) => onFilterChange("search", event.target.value)}
                  placeholder="Search by title, address, city, or location"
                  className="h-12 rounded-xl pl-11 text-base"
                />
              </div>
              <Button type="submit" disabled={searchLoading} className="h-12 px-6">
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
                onClick={() => router.push("/dashboard/renter/map")}
                className="h-12 px-6"
              >
                <Map className="h-4 w-4" aria-hidden="true" />
                Map view
              </Button>
            </div>
          </div>

{/* Second row: all working filters in one aligned row */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-3">
              {/* Approved only */}
              <Badge variant="premium" className="h-10 px-3 text-sm">
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Approved only
              </Badge>

              {/* Property type */}
              <div className="min-w-[180px] flex-1 md:flex-none md:w-[200px]">
                <label htmlFor="propertyType" className="text-xs font-medium uppercase text-neutral-400 mb-1 block">
                  Property type
                </label>
                <Select
                  id="propertyType"
                  value={filters.propertyType}
                  onChange={(event) =>
                    onFilterChange("propertyType", event.target.value)
                  }
                  className="h-10 w-full"
                >
                  <option value="">Any type</option>
                  <option value="Apartment">Apartment</option>
                  <option value="House">House</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Studio">Studio</option>
                  <option value="Room for rent">Room for rent</option>
                </Select>
              </div>

              {/* Price range */}
              <div className="flex gap-3 min-w-[260px] flex-1 md:flex-none md:w-[280px]">
                <div className="flex-1">
                  <label htmlFor="minPrice" className="text-xs font-medium uppercase text-neutral-400 mb-1 block">
                    Min price (PHP)
                  </label>
                  <Input
                    id="minPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.minPrice}
                    onChange={(event) =>
                      onFilterChange("minPrice", event.target.value)
                    }
                    placeholder="0"
                    className="h-10 w-full"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="maxPrice" className="text-xs font-medium uppercase text-neutral-400 mb-1 block">
                    Max price (PHP)
                  </label>
                  <Input
                    id="maxPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.maxPrice}
                    onChange={(event) =>
                      onFilterChange("maxPrice", event.target.value)
                    }
                    placeholder="No limit"
                    className="h-10 w-full"
                  />
                </div>
              </div>

              {/* Amenities */}
              <div className="min-w-[180px] flex-1 md:flex-none md:w-[200px]">
                <label htmlFor="amenity" className="text-xs font-medium uppercase text-neutral-400 mb-1 block">
                  Amenity
                </label>
                <Select
                  id="amenity"
                  value={filters.amenityId}
                  onChange={(event) => onFilterChange("amenityId", event.target.value)}
                  className="h-10 w-full"
                >
                  <option value="">Any amenity</option>
                  {amenities.map((amenity) => (
                    <option key={amenity.id} value={amenity.id}>
                      {amenity.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* City */}
              <div className="min-w-[180px] flex-1 md:flex-none md:w-[200px]">
                <label htmlFor="city" className="text-xs font-medium uppercase text-neutral-400 mb-1 block">
                  City
                </label>
                <Input
                  id="city"
                  type="text"
                  value={filters.city}
                  onChange={(event) => onFilterChange("city", event.target.value)}
                  placeholder="Any city"
                  className="h-10 w-full"
                />
              </div>

              {/* Clear button */}
              <Button
                type="button"
                variant="secondary"
                onClick={onClearFilters}
                disabled={searchLoading}
                className="h-10 px-5"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Clearing...
                  </>
                ) : (
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                )}
                Clear
              </Button>
            </div>
          </div>
        </form>

        <section aria-label="Approved properties" className="space-y-4">
           <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
             <div>
               <p className="text-sm font-semibold text-neutral-950">
                 Showing {properties.length} approved rentals
               </p>
               <p className="text-sm text-neutral-500">
                 Listing cards are prioritized for browsing, comparing, and contacting landlords.
               </p>
             </div>
             <div className="flex flex-wrap items-center gap-2">
               <label htmlFor="sortMode" className="sr-only">
                 Sort rentals
               </label>
<Select
                  id="sortMode"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="h-10 w-48"
                >
                  <option value="newest">Sort: Newest first</option>
                  <option value="price_asc">Price low to high</option>
                  <option value="price_desc">Price high to low</option>
                  <option value="title_asc">Title A-Z</option>
                </Select>
               <Button
                 type="button"
                 variant="secondary"
                 size="icon"
                 onClick={() => setViewMode('grid')}
                 aria-label={viewMode === 'grid' ? 'Grid view active' : 'Switch to grid view'}
                 className={viewMode === 'grid' ? 'bg-neutral-100' : ''}
               >
                 <LayoutGrid className="h-4 w-4" aria-hidden="true" />
               </Button>
               <Button
                 type="button"
                 variant="secondary"
                 size="icon"
                 onClick={() => setViewMode('list')}
                 aria-label={viewMode === 'list' ? 'List view active' : 'Switch to list view'}
                 className={viewMode === 'list' ? 'bg-neutral-100' : ''}
               >
                 <List className="h-4 w-4" aria-hidden="true" />
               </Button>
             </div>
           </div>

          {searchError ? <AlertMessage variant="danger">{searchError}</AlertMessage> : null}
          {listError ? <AlertMessage variant="danger">{listError}</AlertMessage> : null}

           {searchLoading ? (
             <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
               <Skeleton className="h-[420px] w-full" />
               <Skeleton className="h-[420px] w-full" />
               <Skeleton className="h-[420px] w-full" />
               <Skeleton className="hidden h-[420px] w-full 2xl:block" />
             </div>
           ) : properties.length === 0 ? (
             <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
               <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                 <Search className="h-6 w-6" aria-hidden="true" />
               </div>
               <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-950">
                 No approved rentals match this search
               </h2>
               <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                 Try widening the location, price, property type, or amenity filters to
                 see more marketplace listings.
               </p>
               <div className="mt-6 flex justify-center">
                 <Button
                   type="button"
                   variant="secondary"
                   onClick={onClearFilters}
                   disabled={searchLoading}
                 >
                   Clear filters
                 </Button>
               </div>
             </div>
           ) : (
             <div className={viewMode === 'grid' 
               ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
               : 'flex flex-col gap-4'}>
               {sortedProperties.map((property, index) => {
                const description = property.description?.trim();
                const preview = description || "No description provided.";
                const amenityNames = (property.property_amenities ?? [])
                  .map((item) => item.amenities?.name)
                  .filter((name): name is string => Boolean(name));

                const inquiriesForProperty =
                  propertyInquiries[property.id] ?? [];
                const visual = listingVisualClasses(index);
                const newListing = isNewListing(property.created_at);

return (
                    <article
                      key={property.id}
                      className={viewMode === 'grid'
                        ? "group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
                        : "grid grid-cols-1 overflow-hidden rounded-xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300 md:grid-cols-[220px_minmax(0,1fr)_190px]"}
                    >
                      <div className={viewMode === 'grid'
                        ? `relative h-52 shrink-0 ${visual.image}`
                        : `relative h-52 ${visual.image} md:h-full md:min-h-[280px]`}>
                        {(() => {
                          const cover = property.property_images?.find((img) => img.is_cover) ?? property.property_images?.[0];
                          if (cover?.storage_path) {
                            return (
                              <img
                                src={cover.storage_path}
                                alt={property.title}
                                className="h-full w-full object-cover"
                              />
                            );
                          }
                          return (
                            <div className="flex h-full items-center justify-center">
                              <div className="text-center">
                                <Building2 className={`h-10 w-10 ${visual.icon}`} aria-hidden="true" />
                                <p className="mt-1 text-xs text-neutral-500">No photo</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                        <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {newListing ? (
                            <Badge variant="success" className="px-1.5 py-0.5 text-xs">
                              New
                            </Badge>
                          ) : null}
                          <Badge variant={visual.badge} className="px-1.5 py-0.5 text-xs">
                            Approved
                          </Badge>
                          <Badge className="px-1.5 py-0.5 text-xs">
                            {formatVerificationStatus(property.verification_status)}
                          </Badge>
                        </div>
                        <h2 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold leading-7 tracking-tight text-neutral-950">
                          {property.title}
                        </h2>
                        <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">
                            {formatLocation(property) || "Location unavailable"}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm font-medium text-neutral-600">
                          <span className="inline-flex items-center gap-1.5">
                            <BedDouble className="h-4 w-4" aria-hidden="true" />
                            {formatCount(property.bedrooms, "bed")}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Bath className="h-4 w-4" aria-hidden="true" />
                            {formatCount(property.bathrooms, "bath")}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Ruler className="h-4 w-4" aria-hidden="true" />
                            {formatCount(property.area_sqm, "sqm")}
                          </span>
                        </div>
                        <div className="relative min-h-[4.5rem]">
                          <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-neutral-500">
                            {preview}
                          </p>
                        </div>
                        <div className="flex min-h-7 flex-wrap gap-2">
                          <Badge>{property.property_type || "Rental"}</Badge>
                          {amenityNames.slice(0, 2).map((amenity) => (
                            <Badge key={amenity}>{amenity}</Badge>
                          ))}
                          {amenityNames.length > 2 ? (
                            <Badge>+{amenityNames.length - 2}</Badge>
                          ) : null}
                        </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3 text-sm">
                          <div>
                            <p className="text-xs font-medium uppercase text-neutral-400">
                              Deposit
                            </p>
                            <p className="mt-1 font-medium text-neutral-800">
                              {formatPrice(property.deposit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-neutral-400">
                              Advance
                            </p>
                            <p className="mt-1 font-medium text-neutral-800">
                              {formatPrice(property.advance)}
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
                          <div>
                            <p className="text-xs font-medium uppercase text-neutral-400">
                              Interest
                            </p>
                            <p className="mt-1 font-medium text-neutral-800">
                              {inquiriesForProperty.length} inquiries
                            </p>
                          </div>
                        </div>

                        {viewMode === 'grid' ? (
                          <div className="mt-auto space-y-3 pt-4">
                            <p className="text-base font-semibold text-neutral-950">
                              {formatRent(property.price)}
                            </p>
                            <div className="grid gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => setContactPropertyId(property.id)}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                                View details
                              </Button>
                              <button
                                type="button"
                                disabled={favoritesSending[property.id] ?? false}
                                onClick={() => onToggleFavorite(property)}
                                title={favorites[property.id] ? "Remove from saved" : "Add to saved"}
                                aria-label={favorites[property.id] ? "Remove from saved" : "Add to saved"}
                                className={`inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-sm font-medium shadow-sm transition-colors ${
                                  favorites[property.id]
                                    ? "border-red-200 bg-red-50/90 text-red-700"
                                    : "border-neutral-200 bg-white/90 text-neutral-600 hover:border-red-200 hover:bg-red-50/60 hover:text-red-700"
                                } ${favoritesSending[property.id] ? "cursor-wait" : "cursor-pointer"}`}
                              >
                                <Heart
                                  className={`h-4 w-4 ${favorites[property.id] ? "fill-current" : ""}`}
                                  aria-hidden="true"
                                />
                                {favoritesSending[property.id] ? "..." : favorites[property.id] ? "Saved" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            className="mt-auto w-full"
                            onClick={() => setContactPropertyId(property.id)}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                            View details
                          </Button>
                        )}
                       </div>

                      {viewMode === 'list' ? (
                        <div className="flex flex-col justify-between gap-4 border-t border-neutral-100 p-3 sm:p-4 md:border-l md:border-t-0">
                          <p className="text-base font-semibold text-neutral-950">
                            {formatRent(property.price)}
                          </p>
                          <button
                            type="button"
                            disabled={favoritesSending[property.id] ?? false}
                            onClick={() => onToggleFavorite(property)}
                            title={favorites[property.id] ? "Remove from saved" : "Add to saved"}
                            aria-label={favorites[property.id] ? "Remove from saved" : "Add to saved"}
                            className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-sm font-medium shadow-sm transition-colors ${
                              favorites[property.id]
                                ? "border-red-200 bg-red-50/90 text-red-700"
                                : "border-neutral-200 bg-white/90 text-neutral-600 hover:border-red-200 hover:bg-red-50/60 hover:text-red-700"
                            } ${favoritesSending[property.id] ? "cursor-wait" : "cursor-pointer"}`}
                          >
                            <Heart
                              className={`h-4 w-4 ${favorites[property.id] ? "fill-current" : ""}`}
                              aria-hidden="true"
                            />
                            {favoritesSending[property.id] ? "..." : favorites[property.id] ? "Saved" : "Save"}
                          </button>
                        </div>
                      ) : null}
                      </article>
                    );
                })}
              </div>
            )}
          </section>

          <section
            id="my-inquiries"
            aria-label="Marketplace summary"
            className="grid gap-3 border-t border-neutral-200 pt-4 md:grid-cols-3"
          >
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

        {contactProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setContactPropertyId(null)} />
            <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
              <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-neutral-200 p-6">
                <div>
                  <p className="text-xs font-medium uppercase text-neutral-400">Property</p>
                  <h2 className="text-lg font-semibold text-neutral-950">{contactProperty.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setContactPropertyId(null)}
                  className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-5">
                  <section aria-label="Property details" className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-950">Property details</h3>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-600">
                        {contactProperty.description || "No description provided."}
                      </p>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-400">Location</p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {formatLocation(contactProperty) || "Location unavailable"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-400">Monthly rent</p>
                        <p className="mt-1 font-medium text-neutral-800">
                          {formatRent(contactProperty.price)}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section aria-label="Inquiry" className="space-y-3 border-t border-neutral-100 pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-950">Send an inquiry</h3>
                      <p className="text-sm leading-6 text-neutral-500">Ask about availability, lease terms, or viewing times.</p>
                    </div>
                    {inquiryErrors[contactProperty.id] ? (
                      <AlertMessage variant="danger">{inquiryErrors[contactProperty.id]}</AlertMessage>
                    ) : null}
                    {inquirySuccess[contactProperty.id] ? (
                      <AlertMessage variant="success">{inquirySuccess[contactProperty.id]}</AlertMessage>
                    ) : null}
                    <FormField label="Message" htmlFor={`modal-inquiry-${contactProperty.id}`}>
                      <Textarea
                        id={`modal-inquiry-${contactProperty.id}`}
                        value={inquiryMessages[contactProperty.id] ?? ""}
                        onChange={(event) =>
                          onInquiryMessageChange(contactProperty.id, event.target.value)
                        }
                        rows={4}
                        placeholder="Ask about availability, lease terms, or schedule a viewing."
                      />
                    </FormField>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onSendInquiry(contactProperty)}
                      disabled={Boolean(inquirySending[contactProperty.id])}
                      className="w-full"
                    >
                      {inquirySending[contactProperty.id] ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Sending inquiry...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          Send inquiry
                        </>
                      )}
                    </Button>
                  </section>

                  <section aria-label="Reviews" className="space-y-3 border-t border-neutral-100 pt-5">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-950">Reviews</h3>
                      <p className="text-sm leading-6 text-neutral-500">You can review this listing after sending an inquiry.</p>
                    </div>
                    {(propertyInquiries[contactProperty.id] ?? []).length === 0 ? (
                      <AlertMessage variant="info">Send an inquiry for this property first before leaving a review.</AlertMessage>
                    ) : null}
                    {reviewErrors[contactProperty.id] ? (
                      <AlertMessage variant="danger">{reviewErrors[contactProperty.id]}</AlertMessage>
                    ) : null}
                    {reviewSuccess[contactProperty.id] ? (
                      <AlertMessage variant="success">{reviewSuccess[contactProperty.id]}</AlertMessage>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                      <FormField label="Rating" htmlFor={`modal-rating-${contactProperty.id}`}>
                        <Select
                          id={`modal-rating-${contactProperty.id}`}
                          value={reviewDrafts[contactProperty.id]?.rating ?? ""}
                          onChange={(event) =>
                            onReviewDraftChange(contactProperty.id, "rating", event.target.value)
                          }
                          disabled={(propertyInquiries[contactProperty.id] ?? []).length === 0}
                        >
                          <option value="">Select</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </Select>
                      </FormField>
                      <FormField label="Comment" htmlFor={`modal-comment-${contactProperty.id}`}>
                        <Textarea
                          id={`modal-comment-${contactProperty.id}`}
                          value={reviewDrafts[contactProperty.id]?.comment ?? ""}
                          onChange={(event) =>
                            onReviewDraftChange(contactProperty.id, "comment", event.target.value)
                          }
                          rows={3}
                          placeholder="Share your experience (optional)."
                          disabled={(propertyInquiries[contactProperty.id] ?? []).length === 0}
                        />
                      </FormField>
                    </div>
                    <Button
                      type="button"
                      onClick={() => onSubmitReview(contactProperty)}
                      disabled={(propertyInquiries[contactProperty.id] ?? []).length === 0 || Boolean(reviewSending[contactProperty.id])}
                      className="w-full"
                    >
                      {reviewSending[contactProperty.id] ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Submitting review...
                        </>
                      ) : (
                        <>
                          <Star className="h-4 w-4" aria-hidden="true" />
                          Submit review
                        </>
                      )}
                    </Button>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-neutral-900">Recent reviews</p>
                      {(propertyReviews[contactProperty.id] ?? []).length === 0 ? (
                        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">No reviews yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(propertyReviews[contactProperty.id] ?? []).map((review) => (
                            <li key={review.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-neutral-950">{review.rating}/5</span>
                                <span className="text-xs text-neutral-500">
                                  {new Date(review.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {review.comment ? (
                                <p className="mt-2 leading-6 text-neutral-600">{review.comment}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }
