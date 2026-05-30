"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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

    if (activeFilters.amenityId) {
      query = query.eq("property_amenities.amenity_id", activeFilters.amenityId);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setSearchError(queryError.message);
      setProperties([]);
      setSearchLoading(false);
      return [];
    }

    const nextProperties = normalizeProperties((data ?? []) as PropertyRow[]);
    setProperties(nextProperties);
    setSearchLoading(false);
    return nextProperties;
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
      <main>
        <p>Loading renter dashboard...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Renter Dashboard</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: renter</p>
      <p>
        <button type="button" onClick={() => router.push("/dashboard/renter/map")}>
          View map
        </button>
      </p>
      <p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/renter/recommendations")}
        >
          View recommendations
        </button>
      </p>
      <p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/renter/assistant")}
        >
          Chat with assistant
        </button>
      </p>

      <section aria-label="Property search">
        <h2>Search approved properties</h2>
        <form onSubmit={onSearch}>
          <label>
            Search
            <input
              type="text"
              value={filters.search}
              onChange={(event) => onFilterChange("search", event.target.value)}
              placeholder="Title, description, address, or city"
            />
          </label>
          <label>
            City
            <input
              type="text"
              value={filters.city}
              onChange={(event) => onFilterChange("city", event.target.value)}
            />
          </label>
          <label>
            Property type
            <input
              type="text"
              value={filters.propertyType}
              onChange={(event) => onFilterChange("propertyType", event.target.value)}
            />
          </label>
          <label>
            Min price
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.minPrice}
              onChange={(event) => onFilterChange("minPrice", event.target.value)}
            />
          </label>
          <label>
            Max price
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.maxPrice}
              onChange={(event) => onFilterChange("maxPrice", event.target.value)}
            />
          </label>
          <label>
            Amenity
            <select
              value={filters.amenityId}
              onChange={(event) => onFilterChange("amenityId", event.target.value)}
            >
              <option value="">Any amenity</option>
              {amenities.map((amenity) => (
                <option key={amenity.id} value={amenity.id}>
                  {amenity.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button type="submit" disabled={searchLoading}>
              {searchLoading ? "Searching..." : "Search"}
            </button>
            <button type="button" onClick={onClearFilters} disabled={searchLoading}>
              Clear filters
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Approved properties">
        <h2>Approved properties</h2>
        {searchError ? <p role="alert">{searchError}</p> : null}
        {listError ? <p role="alert">{listError}</p> : null}
        {searchLoading ? (
          <p>Loading approved properties...</p>
        ) : properties.length === 0 ? (
          <p>No approved properties match your filters yet.</p>
        ) : (
          <div>
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
                <article key={property.id}>
                  <h3>{property.title}</h3>
                  <p>{preview}</p>
                  <p>Type: {property.property_type || "Not specified"}</p>
                  <p>
                    Location: {property.city || ""}
                    {property.state ? `, ${property.state}` : ""}
                    {property.country ? `, ${property.country}` : ""}
                  </p>
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

                  <section aria-label="Inquiry">
                    <h4>Send an inquiry</h4>
                    {inquiryErrors[property.id] ? (
                      <p role="alert">{inquiryErrors[property.id]}</p>
                    ) : null}
                    {inquirySuccess[property.id] ? (
                      <p>{inquirySuccess[property.id]}</p>
                    ) : null}
                    <label>
                      Message
                      <textarea
                        value={inquiryDraft}
                        onChange={(event) =>
                          onInquiryMessageChange(property.id, event.target.value)
                        }
                        rows={3}
                        placeholder="Ask about availability, lease terms, or schedule a viewing."
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onSendInquiry(property)}
                      disabled={Boolean(inquirySending[property.id])}
                    >
                      {inquirySending[property.id]
                        ? "Sending inquiry..."
                        : "Send inquiry"}
                    </button>
                  </section>

                  <section aria-label="Reviews">
                    <h4>Leave a review</h4>
                    {!hasInquiry ? (
                      <p>
                        Send an inquiry for this property first before leaving a
                        review.
                      </p>
                    ) : null}
                    {reviewErrors[property.id] ? (
                      <p role="alert">{reviewErrors[property.id]}</p>
                    ) : null}
                    {reviewSuccess[property.id] ? (
                      <p>{reviewSuccess[property.id]}</p>
                    ) : null}
                    <label>
                      Rating
                      <select
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
                        <option value="">Select rating</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </label>
                    <label>
                      Comment
                      <textarea
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
                    </label>
                    <button
                      type="button"
                      onClick={() => onSubmitReview(property)}
                      disabled={!hasInquiry || Boolean(reviewSending[property.id])}
                    >
                      {reviewSending[property.id]
                        ? "Submitting review..."
                        : "Submit review"}
                    </button>

                    <div>
                      <h5>Reviews</h5>
                      {reviewsForProperty.length === 0 ? (
                        <p>No reviews yet.</p>
                      ) : (
                        <ul>
                          {reviewsForProperty.map((review) => (
                            <li key={review.id}>
                              <strong>Rating:</strong> {review.rating}/5
                              {review.comment ? ` - ${review.comment}` : ""}
                              <div>
                                {new Date(review.created_at).toLocaleDateString()}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </article>
              );
            })}
          </div>
        )}
        <p>
          Testing note: Until admin approval is implemented, manually approve a
          property in Supabase using{` update properties set status = 'approved' where id = '';`}.
        </p>
      </section>

      <LogoutButton />
    </main>
  );
}
