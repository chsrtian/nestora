"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Compass,
  Crosshair,
  Home,
  Map,
  MapPin,
  Navigation,
  Sparkles,
  Wallet,
} from "lucide-react";
import type {
  MapContainerProps,
  MarkerProps,
  PopupProps,
  TileLayerProps,
} from "react-leaflet";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import { PageHeader } from "@/app/components/layout/page-header";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";

const MapContainer = dynamic<MapContainerProps>(
  () =>
    import("react-leaflet").then(
      (mod) => mod.MapContainer as unknown as ComponentType<MapContainerProps>,
    ),
  { ssr: false },
);
const TileLayer = dynamic<TileLayerProps>(
  () =>
    import("react-leaflet").then(
      (mod) => mod.TileLayer as unknown as ComponentType<TileLayerProps>,
    ),
  { ssr: false },
);
const Marker = dynamic<MarkerProps>(
  () =>
    import("react-leaflet").then(
      (mod) => mod.Marker as unknown as ComponentType<MarkerProps>,
    ),
  { ssr: false },
);
const Popup = dynamic<PopupProps>(
  () =>
    import("react-leaflet").then(
      (mod) => mod.Popup as unknown as ComponentType<PopupProps>,
    ),
  { ssr: false },
);

type MapProperty = {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  country: string | null;
  price: number;
  property_type: string | null;
  deposit: number;
  advance: number;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

const DEFAULT_CENTER: [number, number] = [20, 0];

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

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLocation(property: MapProperty) {
  return [property.city, property.state, property.country].filter(Boolean).join(", ");
}

function hasValidCoordinates(property: MapProperty) {
  return (
    typeof property.lat === "number" &&
    typeof property.lng === "number" &&
    Number.isFinite(property.lat) &&
    Number.isFinite(property.lng) &&
    property.lat >= -90 &&
    property.lat <= 90 &&
    property.lng >= -180 &&
    property.lng <= 180
  );
}

export default function RenterMapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(2);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasUserLocation, setHasUserLocation] = useState(false);

  useEffect(() => {
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted) return;
      const defaultIcon = L.Icon.Default;
      delete (defaultIcon.prototype as { _getIconUrl?: string })._getIconUrl;
      defaultIcon.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

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

      const { data, error: propertiesError } = await client
        .from("properties")
        .select(
          "id, title, city, state, country, price, property_type, deposit, advance, lat, lng, created_at",
        )
        .eq("status", "approved")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (propertiesError) {
        setError(propertiesError.message);
        setLoading(false);
        return;
      }

      setProperties((data ?? []) as MapProperty[]);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const mapProperties = useMemo(
    () => properties.filter((property) => hasValidCoordinates(property)),
    [properties],
  );

  const initialListingCenter = useMemo<[number, number]>(() => {
    const first = mapProperties[0];
    return first ? [first.lat!, first.lng!] : DEFAULT_CENTER;
  }, [mapProperties]);

  const displayedMapCenter = hasUserLocation ? mapCenter : initialListingCenter;
  const displayedMapZoom = hasUserLocation
    ? mapZoom
    : mapProperties.length > 0
      ? 12
      : 2;

  const cityCount = useMemo(
    () =>
      new Set(
        mapProperties
          .map((property) => formatLocation(property))
          .filter((location) => location),
      ).size,
    [mapProperties],
  );

  const averagePrice = useMemo(() => {
    if (mapProperties.length === 0) return null;
    const total = mapProperties.reduce((sum, property) => sum + property.price, 0);
    return Math.round(total / mapProperties.length);
  }, [mapProperties]);

  const onUseLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not available in this browser.");
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setMapZoom(13);
        setHasUserLocation(true);
      },
      () => {
        setLocationError("Unable to access your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Rental Marketplace">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-[32rem] max-w-full" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
            <Skeleton className="h-[680px] w-full" />
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
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
      className="pb-6"
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <PageHeader
          eyebrow="Renter map"
          title="Explore approved rentals by location"
          description="Scan approved rentals geographically and keep nearby listings close while you browse."
          className="gap-3"
          actions={
            <Button type="button" onClick={onUseLocation} variant="secondary">
              {hasUserLocation ? (
                <Navigation className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              {hasUserLocation ? "Using your area" : "Use my location"}
            </Button>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {locationError ? (
          <AlertMessage variant="warning">{locationError}</AlertMessage>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Mapped rentals",
              value: mapProperties.length,
              icon: <MapPin className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Areas",
              value: cityCount,
              icon: <Compass className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Avg. price",
              value: averagePrice === null ? "N/A" : formatPrice(averagePrice),
              icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
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
        </div>

        <section
          aria-label="Approved rental map and list"
          className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]"
        >
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-neutral-950">
                    Marketplace map
                  </h2>
                  <Badge variant="success">Approved only</Badge>
                  <Badge variant="info">Valid coordinates</Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Listings without valid latitude and longitude stay out of this
                  view.
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                Zoom {displayedMapZoom}
              </div>
            </div>

            {mapProperties.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No mapped rentals are available"
                  description="Approved properties need valid latitude and longitude values before they appear on the renter map."
                  icon={<Map className="h-5 w-5" aria-hidden="true" />}
                />
              </div>
            ) : (
              <MapContainer
                center={displayedMapCenter}
                zoom={displayedMapZoom}
                scrollWheelZoom
                style={{ height: "min(72vh, 760px)", minHeight: "560px", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapProperties.map((property) => (
                  <Marker
                    key={property.id}
                    position={[property.lat!, property.lng!]}
                  >
                    <Popup>
                      <strong>{property.title}</strong>
                      <div>{formatLocation(property) || "Location unavailable"}</div>
                      <div>Price: {formatPrice(property.price)}</div>
                      <div>Type: {property.property_type || "Not specified"}</div>
                      <div>Deposit: {property.deposit}</div>
                      <div>Advance: {property.advance}</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </Card>

          <Card className="xl:sticky xl:top-20 xl:self-start">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Map listings</CardTitle>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Prioritized by newest approved listing.
                  </p>
                </div>
                <Badge>{mapProperties.length} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {mapProperties.length === 0 ? (
                <EmptyState
                  title="No coordinate-ready rentals"
                  description="When approved rentals include valid map coordinates, they will appear here."
                  icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                  className="p-6"
                />
              ) : (
                <div className="max-h-[calc(72vh-44px)] min-h-[500px] space-y-2 overflow-y-auto pr-1">
                  {mapProperties.map((property, index) => (
                    <article
                      key={property.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            #{index + 1} on map
                          </p>
                          <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-neutral-950">
                            {property.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-1">
                              {formatLocation(property) || "Location unavailable"}
                            </span>
                          </p>
                        </div>
                        <Badge variant="success">Approved</Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Price
                          </p>
                          <p className="mt-1 font-semibold text-neutral-950">
                            {formatPrice(property.price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Type
                          </p>
                          <p className="mt-1 font-medium text-neutral-700">
                            {property.property_type || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Deposit
                          </p>
                          <p className="mt-1 font-medium text-neutral-700">
                            {property.deposit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-neutral-400">
                            Advance
                          </p>
                          <p className="mt-1 font-medium text-neutral-700">
                            {property.advance}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
