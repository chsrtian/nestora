"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Home,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Sparkles,
  Wallet,
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
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
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

const landlordNavItems: SidebarNavItem[] = [
  { href: "/dashboard/landlord", label: "Host dashboard", icon: Home },
  {
    href: "/dashboard/landlord/properties/new",
    label: "Post property",
    icon: Plus,
  },
];

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
        price: form.price ? Number(form.price) : null,
        deposit: form.deposit ? Number(form.deposit) : null,
        advance: form.advance ? Number(form.advance) : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
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
      <AppShell navItems={landlordNavItems} title="Host Marketplace">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-[32rem] max-w-full" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navItems={landlordNavItems}
      title="Host Marketplace"
      sidebarFooter={<LogoutButton />}
      className="pb-8"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="New host listing"
          title="Create a polished rental listing"
          description="Group the essentials renters scan first, then submit the property for marketplace review."
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.replace("/dashboard/landlord")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        <div className="grid gap-3 md:grid-cols-5">
          {[
            "Basics",
            "Pricing",
            "Property details",
            "Location",
            "Amenities",
          ].map((section, index) => (
            <div
              key={section}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium uppercase text-neutral-400">
                Step {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {section}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Card className="overflow-hidden shadow-sm">
              <div className="h-1 bg-violet-500" />
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="premium">Basics</Badge>
                    <CardTitle className="mt-3 text-lg">Name the stay</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Name the listing and describe what renters should expect.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField label="Title *" htmlFor="title" className="md:col-span-2">
                  <Input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(e) => onChange("title", e.target.value)}
                    required
                    placeholder="Bright studio near campus"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Property type" htmlFor="property_type">
                  <Input
                    id="property_type"
                    type="text"
                    value={form.property_type}
                    onChange={(e) => onChange("property_type", e.target.value)}
                    placeholder="Apartment, studio, house"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Available from" htmlFor="available_from">
                  <Input
                    id="available_from"
                    type="date"
                    value={form.available_from}
                    onChange={(e) => onChange("available_from", e.target.value)}
                    className="h-11"
                  />
                </FormField>
                <FormField label="Description" htmlFor="description" className="md:col-span-2">
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="Share lease details, nearby landmarks, and what makes the space comfortable."
                    className="min-h-36"
                  />
                </FormField>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="premium">Pricing</Badge>
                    <CardTitle className="mt-3 text-lg">Set move-in costs</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Set rent and move-in cash requirements in PHP.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <FormField label="Price (PHP)" htmlFor="price">
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => onChange("price", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Deposit (PHP)" htmlFor="deposit">
                  <Input
                    id="deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.deposit}
                    onChange={(e) => onChange("deposit", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Advance (PHP)" htmlFor="advance">
                  <Input
                    id="advance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.advance}
                    onChange={(e) => onChange("advance", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                    <Ruler className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="premium">Property details</Badge>
                    <CardTitle className="mt-3 text-lg">Describe the space</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Add capacity and size information for browsing renters.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <FormField label="Bedrooms" htmlFor="bedrooms">
                  <Input
                    id="bedrooms"
                    type="number"
                    min="0"
                    value={form.bedrooms}
                    onChange={(e) => onChange("bedrooms", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Bathrooms" htmlFor="bathrooms">
                  <Input
                    id="bathrooms"
                    type="number"
                    min="0"
                    value={form.bathrooms}
                    onChange={(e) => onChange("bathrooms", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Area (sqm)" htmlFor="area_sqm">
                  <Input
                    id="area_sqm"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.area_sqm}
                    onChange={(e) => onChange("area_sqm", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                </FormField>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="premium">Location</Badge>
                    <CardTitle className="mt-3 text-lg">Place it on the map</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Provide the address and optional map coordinates.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField label="Address line" htmlFor="address_line" className="md:col-span-2">
                  <Input
                    id="address_line"
                    type="text"
                    value={form.address_line}
                    onChange={(e) => onChange("address_line", e.target.value)}
                    placeholder="Street, building, or neighborhood"
                    className="h-11"
                  />
                </FormField>
                <FormField label="City *" htmlFor="city">
                  <Input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={(e) => onChange("city", e.target.value)}
                    required
                    placeholder="City"
                    className="h-11"
                  />
                </FormField>
                <FormField label="State / Province" htmlFor="state">
                  <Input
                    id="state"
                    type="text"
                    value={form.state}
                    onChange={(e) => onChange("state", e.target.value)}
                    placeholder="State or province"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Country *" htmlFor="country">
                  <Input
                    id="country"
                    type="text"
                    value={form.country}
                    onChange={(e) => onChange("country", e.target.value)}
                    required
                    placeholder="Country"
                    className="h-11"
                  />
                </FormField>
                <div className="hidden md:block" />
                <FormField label="Latitude" htmlFor="lat">
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => onChange("lat", e.target.value)}
                    placeholder="Optional"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Longitude" htmlFor="lng">
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => onChange("lng", e.target.value)}
                    placeholder="Optional"
                    className="h-11"
                  />
                </FormField>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="premium">Amenities</Badge>
                    <CardTitle className="mt-3 text-lg">Highlight what is included</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Select the features renters can use at this property.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {amenities.length === 0 ? (
                  <EmptyState
                    title="No amenities available"
                    description="Amenities configured for the marketplace will appear here."
                    icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
                    className="p-6"
                  />
                ) : (
                  <fieldset>
                    <legend className="sr-only">Amenities</legend>
                    <div className="flex flex-wrap gap-2">
                      {amenities.map((amenity) => {
                        const selected = selectedAmenities.has(amenity.id);

                        return (
                          <label
                            key={amenity.id}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                              selected
                                ? "border-violet-200 bg-violet-50 text-violet-700 shadow-sm"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={selected}
                              onChange={() => onAmenityToggle(amenity.id)}
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
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="border-neutral-950/10 shadow-sm">
              <CardHeader className="p-5 pb-0">
                <Badge variant="warning">Pending review</Badge>
                <CardTitle className="mt-3 text-lg">Submission summary</CardTitle>
                <p className="text-sm leading-6 text-neutral-500">
                  New properties are submitted for marketplace review.
                </p>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="border-y border-amber-200 bg-amber-50/70 py-4">
                  <p className="px-4 text-xs font-medium uppercase text-amber-800">
                    Initial status
                  </p>
                  <div className="mt-2 flex items-center gap-2 px-4">
                    <Badge variant="warning">Pending</Badge>
                    <span className="text-sm text-amber-900">
                      Awaiting approval
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Title, city, and country required
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Availability date is optional
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Amenities save after listing creation
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {submitting ? "Creating..." : "Create property"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.replace("/dashboard/landlord")}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to dashboard
                </Button>
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
