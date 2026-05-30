"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";

type Amenity = {
  id: string;
  name: string;
};

type PropertyForm = {
  title: string;
  description: string;
  property_type: string;
  price: string;
  deposit: string;
  advance: string;
  bedrooms: string;
  bathrooms: string;
  area_sqm: string;
  address_line: string;
  city: string;
  state: string;
  country: string;
  lat: string;
  lng: string;
  available_from: string;
};

export default function NewPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(
    new Set(),
  );
  const [form, setForm] = useState<PropertyForm>({
    title: "",
    description: "",
    property_type: "",
    price: "",
    deposit: "",
    advance: "",
    bedrooms: "",
    bathrooms: "",
    area_sqm: "",
    address_line: "",
    city: "",
    state: "",
    country: "",
    lat: "",
    lng: "",
    available_from: "",
  });

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

      if (profile.role !== "landlord") {
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

  const onChange = (
    key: keyof PropertyForm,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onAmenityToggle = (amenityId: string) => {
    setSelectedAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(amenityId)) {
        next.delete(amenityId);
      } else {
        next.add(amenityId);
      }
      return next;
    });
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "Title is required.";
    if (!form.city.trim()) return "City is required.";
    if (!form.country.trim()) return "Country is required.";
    if (form.price && Number(form.price) < 0) return "Price must be non-negative.";
    if (form.deposit && Number(form.deposit) < 0) return "Deposit must be non-negative.";
    if (form.advance && Number(form.advance) < 0) return "Advance must be non-negative.";
    if (form.bedrooms && Number(form.bedrooms) < 0) return "Bedrooms must be non-negative.";
    if (form.bathrooms && Number(form.bathrooms) < 0) return "Bathrooms must be non-negative.";
    if (form.area_sqm && Number(form.area_sqm) < 0) return "Area must be non-negative.";
    return null;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      setSubmitting(false);
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      setError("Session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const { data: property, error: propertyError } = await client
      .from("properties")
      .insert({
        landlord_id: sessionData.session.user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        property_type: form.property_type.trim() || null,
        price: form.price ? Number(form.price) : 0,
        deposit: form.deposit ? Number(form.deposit) : 0,
        advance: form.advance ? Number(form.advance) : 0,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : 0,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : 0,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : 0,
        address_line: form.address_line.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        country: form.country.trim(),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        available_from: form.available_from || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (propertyError) {
      setError(propertyError.message);
      setSubmitting(false);
      return;
    }

    if (selectedAmenities.size > 0 && property) {
      const amenityRows = Array.from(selectedAmenities).map((amenityId) => ({
        property_id: property.id,
        amenity_id: amenityId,
      }));

      const { error: amenitiesError } = await client
        .from("property_amenities")
        .insert(amenityRows);

      if (amenitiesError) {
        setError(
          "Property created but amenities failed: " + amenitiesError.message,
        );
        setSubmitting(false);
        return;
      }
    }

    router.replace("/dashboard/landlord");
  };

  if (loading) {
    return (
      <main>
        <p>Loading property form...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create Property</h1>
      <form onSubmit={onSubmit}>
        <label>
          Title *
          <input
            type="text"
            value={form.title}
            onChange={(e) => onChange("title", e.target.value)}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </label>
        <label>
          Property Type
          <input
            type="text"
            value={form.property_type}
            onChange={(e) => onChange("property_type", e.target.value)}
          />
        </label>
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => onChange("price", e.target.value)}
          />
        </label>
        <label>
          Deposit
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.deposit}
            onChange={(e) => onChange("deposit", e.target.value)}
          />
        </label>
        <label>
          Advance
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.advance}
            onChange={(e) => onChange("advance", e.target.value)}
          />
        </label>
        <label>
          Bedrooms
          <input
            type="number"
            min="0"
            value={form.bedrooms}
            onChange={(e) => onChange("bedrooms", e.target.value)}
          />
        </label>
        <label>
          Bathrooms
          <input
            type="number"
            min="0"
            value={form.bathrooms}
            onChange={(e) => onChange("bathrooms", e.target.value)}
          />
        </label>
        <label>
          Area (sqm)
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.area_sqm}
            onChange={(e) => onChange("area_sqm", e.target.value)}
          />
        </label>
        <label>
          Address Line
          <input
            type="text"
            value={form.address_line}
            onChange={(e) => onChange("address_line", e.target.value)}
          />
        </label>
        <label>
          City *
          <input
            type="text"
            value={form.city}
            onChange={(e) => onChange("city", e.target.value)}
            required
          />
        </label>
        <label>
          State / Province
          <input
            type="text"
            value={form.state}
            onChange={(e) => onChange("state", e.target.value)}
          />
        </label>
        <label>
          Country *
          <input
            type="text"
            value={form.country}
            onChange={(e) => onChange("country", e.target.value)}
            required
          />
        </label>
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={form.lat}
            onChange={(e) => onChange("lat", e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={form.lng}
            onChange={(e) => onChange("lng", e.target.value)}
          />
        </label>
        <label>
          Available From
          <input
            type="date"
            value={form.available_from}
            onChange={(e) => onChange("available_from", e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Amenities</legend>
          {amenities.map((a) => (
            <label key={a.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={selectedAmenities.has(a.id)}
                onChange={() => onAmenityToggle(a.id)}
              />
              {a.name}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Property"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        <button type="button" onClick={() => router.replace("/dashboard/landlord")}>
          Back to Dashboard
        </button>
      </p>
      <p>Image upload will be added after storage setup.</p>
    </main>
  );
}