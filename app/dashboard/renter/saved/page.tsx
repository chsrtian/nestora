"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bath, BedDouble, Building2, Heart, MapPin, Ruler } from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { formatMonthlyRentInPHP } from "@/lib/currency";
import { toggleFavorite } from "@/lib/favorites";

type Property = {
  id: string;
  title: string;
  description: string | null;
  property_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  created_at: string;
  property_images?: { storage_path: string; is_cover: boolean }[] | null;
};

const renterNavItems: SidebarNavItem[] = [
  { href: "/dashboard/renter", label: "Browse rentals", icon: Building2 },
  { href: "/dashboard/renter/map", label: "Map", icon: MapPin },
  {
    href: "/dashboard/renter/recommendations",
    label: "Recommendations",
    icon: Ruler,
  },
  {
    href: "/dashboard/renter/assistant",
    label: "AI Assistant",
    icon: Building2,
  },
  {
    href: "/dashboard/renter/saved",
    label: "Saved",
    icon: Heart,
  },
  {
    href: "/dashboard/renter/inquiries",
    label: "My inquiries",
    icon: Building2,
  },
];

function formatCount(value: number | null, unit: string) {
  return typeof value === "number" ? `${value} ${unit}` : "Not listed";
}

export default function SavedRentalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [removingSaved, setRemovingSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialize = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setLoading(false);
        return;
      }

      const userData = await client.auth.getUser();
      if (userData.error || !userData.data.user) {
        router.push("/login");
        return;
      }

      const userId = userData.data.user.id;
      setRenterId(userId);
      setEmail(userData.data.user.email ?? null);
      setAuthCookie();

      const { profile, error: profileError } = await ensureProfile(client, userId);
      if (profileError || !profile) {
        setError(profileError || "Failed to load profile.");
        setLoading(false);
        return;
      }

      // Fetch saved rentals
      const { data: favorites, error: favError } = await client
        .from("favorites")
        .select("id, property_id, created_at, properties(id, title, description, property_type, city, state, country, price, bedrooms, bathrooms, area_sqm, created_at, property_images(storage_path, is_cover))")
        .eq("renter_id", userId)
        .order("created_at", { ascending: false });

      if (favError) {
        setError(favError.message ?? "Failed to load saved rentals.");
        setLoading(false);
        return;
      }

      // Handle the response properly - properties might be nested in different formats
      const favoritesList = favorites as unknown as Array<Record<string, unknown>>;
      const properties = (favoritesList ?? [])
        .map((fav: Record<string, unknown>) => {
          const prop = Array.isArray(fav.properties) ? (fav.properties[0] as Property) : (fav.properties as Property);
          return prop;
        })
        .filter((prop): prop is Property => Boolean(prop) && "id" in prop && "title" in prop);

      setSavedProperties(properties);
      setLoading(false);
    };

    initialize();
  }, [router]);

  const onRemoveSaved = async (propertyId: string) => {
    if (!renterId) return;

    const client = getSupabaseClient();
    if (!client) return;

    setRemovingSaved((prev) => ({ ...prev, [propertyId]: true }));

    const result = await toggleFavorite(client, propertyId, renterId);
    if (!result.success) {
      setError(result.error ?? "Failed to remove saved rental.");
      setRemovingSaved((prev) => ({ ...prev, [propertyId]: false }));
      return;
    }

    setSavedProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setRemovingSaved((prev) => ({ ...prev, [propertyId]: false }));
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Saved Rentals">
        <div className="mx-auto max-w-[1800px] space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <Skeleton className="h-[380px] w-full" />
            <Skeleton className="h-[380px] w-full" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navItems={renterNavItems}
      title="Saved Rentals"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="px-3 py-3 pb-5 sm:px-4 lg:px-6"
    >
      <div className="mx-auto max-w-[1800px] space-y-4">
        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        {savedProperties.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" aria-hidden="true" />}
            title="No saved rentals yet"
            description="Browse rentals and click the heart icon to save your favorites."
            action={
              <Button onClick={() => router.push("/dashboard/renter")}>
                Browse Rentals
              </Button>
            }
          />
        ) : (
          <>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-600">
                You have {savedProperties.length} saved {savedProperties.length === 1 ? "rental" : "rentals"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {savedProperties.map((property) => (
                <article
                  key={property.id}
                  className="group overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
                >
                  <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#f5f5f4,#e7e5e4)]">
                    {(() => {
                      const cover =
                        property.property_images?.find((image) => image.is_cover) ??
                        property.property_images?.[0];

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
                            <Building2 className="mx-auto h-12 w-12 text-neutral-500" aria-hidden="true" />
                            <p className="mt-2 text-xs text-neutral-500">No photo</p>
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      disabled={removingSaved[property.id] ?? false}
                      onClick={() => onRemoveSaved(property.id)}
                      className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/90 px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100"
                    >
                      <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
                      {removingSaved[property.id] ? "..." : "Saved"}
                    </button>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold tracking-tight text-neutral-950">
                        {formatMonthlyRentInPHP(property.price)}
                      </p>
                      <h2 className="line-clamp-1 text-base font-medium text-neutral-950">
                        {property.title}
                      </h2>
                      <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        <span className="line-clamp-1">
                          {[property.city, property.state, property.country]
                            .filter(Boolean)
                            .join(", ") || "Location unavailable"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
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

                    {property.description && (
                      <p className="line-clamp-2 text-sm leading-6 text-neutral-500">
                        {property.description}
                      </p>
                    )}

                    <div className="border-t border-neutral-100 pt-3">
                      <Button
                        onClick={() => router.push(`/dashboard/renter?property=${property.id}`)}
                        variant="secondary"
                        className="w-full"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
