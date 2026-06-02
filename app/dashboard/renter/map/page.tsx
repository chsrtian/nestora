"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Bookmark,
  Camera,
  Crosshair,
  Home,
  Image as ImageIcon,
  Loader2,
  Map,
  MapPin,
  Maximize2,
  MessageSquare,
  Navigation,
  PencilRuler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { formatPriceInPHP } from "@/lib/currency";
import { MapLibreRentalMap } from "./maplibre-rental-map";
import type { MapBounds } from "./maplibre-rental-map";

type MapProperty = {
  id: string;
  title: string;
  description: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  price: number | null;
  property_type: string | null;
  deposit: number | null;
  advance: number | null;
  available_from: string | null;
  lat: number | null;
  lng: number | null;
  verification_status: "verified" | "needs_verification" | "incomplete" | null;
  source_url: string | null;
  source_note: string | null;
  created_at: string;
  property_images?: PropertyImage[] | null;
  property_amenities?: PropertyAmenity[] | null;
  reviews?: PropertyReview[] | null;
};

type PropertyImage = {
  storage_path: string;
  is_cover: boolean;
};

type PropertyAmenity = {
  amenity_id: string;
  amenities: { name: string } | null;
};

type EmbeddedOne<T> = T | T[] | null;

type PropertyAmenityRow = Omit<PropertyAmenity, "amenities"> & {
  amenities: EmbeddedOne<PropertyAmenity["amenities"]>;
};

type PropertyReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type MapPropertyRow = Omit<MapProperty, "property_amenities" | "property_images" | "reviews"> & {
  property_amenities?: PropertyAmenityRow[] | null;
  property_images?: PropertyImage[] | null;
  reviews?: PropertyReview[] | null;
};

type SavedSearchInsert = {
  renter_id: string;
  name: string;
  query: string | null;
  city: string | null;
  property_type: string | null;
  min_price: number | null;
  max_price: number | null;
  map_bounds: MapBounds | null;
};

type ZoneSearchState = "idle" | "loading" | "complete";

const DEFAULT_CENTER: [number, number] = [20, 0];
const CABADBARAN_SEED_SOURCE_PATTERN = "%Cabadbaran accommodation seed%";
const MAP_PROPERTY_SELECT =
  "id, title, description, address_line, city, state, country, price, property_type, deposit, advance, available_from, lat, lng, created_at, verification_status, source_url, source_note, property_images(storage_path, is_cover), property_amenities(amenity_id, amenities(name)), reviews(id, rating, comment, created_at)";
const ZONE_SEARCH_DELAY_MS = 450;

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

function formatPrice(value: number | null) {
  return formatPriceInPHP(value);
}

function normalizeEmbeddedOne<T>(value: EmbeddedOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function normalizeMapProperties(rows: MapPropertyRow[]): MapProperty[] {
  return rows.map((property) => ({
    ...property,
    property_amenities:
      property.property_amenities?.map((amenity) => ({
        ...amenity,
        amenities: normalizeEmbeddedOne(amenity.amenities),
      })) ?? null,
    property_images: property.property_images ?? null,
    reviews: property.reviews ?? null,
  }));
}

function formatLocation(property: MapProperty) {
  return [property.city, property.state, property.country].filter(Boolean).join(", ");
}

function formatAddress(property: MapProperty) {
  return [property.address_line, property.city, property.state, property.country]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString();
}

function formatVerificationStatus(status: MapProperty["verification_status"]) {
  if (status === "verified") return "Source verified";
  if (status === "incomplete") return "Incomplete";
  return "Needs verification";
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

function isPropertyInsideBounds(property: MapProperty, bounds: MapBounds) {
  if (typeof property.lat !== "number" || typeof property.lng !== "number") {
    return false;
  }

  return (
    property.lat >= bounds.south &&
    property.lat <= bounds.north &&
    property.lng >= bounds.west &&
    property.lng <= bounds.east
  );
}

function formatZoom(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getPropertyImages(property: MapProperty | null) {
  if (!property) return [];

  const images = property.property_images ?? [];
  return [...images].sort((first, second) => {
    if (first.is_cover === second.is_cover) return 0;
    return first.is_cover ? -1 : 1;
  });
}

function getAmenityNames(property: MapProperty | null) {
  if (!property) return [];

  return (property.property_amenities ?? [])
    .map((item) => item.amenities?.name)
    .filter((name): name is string => Boolean(name));
}

function formatSavedSearchError(error: { code?: string; message?: string }) {
  if (
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("schema cache") ||
    error.message?.includes("renter_saved_searches")
  ) {
    return "Saved searches are not ready in Supabase yet. Apply migration 0008_renter_saved_searches.sql and refresh the schema cache.";
  }

  if (error.code === "23505") {
    return "You already saved this search.";
  }

  return error.message ?? "Failed to save this search.";
}

async function fetchVerifiedMapProperties(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
) {
  const { data, error } = await client
    .from("properties")
    .select(MAP_PROPERTY_SELECT)
    .eq("status", "approved")
    .eq("verification_status", "verified")
    .ilike("source_note", CABADBARAN_SEED_SOURCE_PATTERN)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .or("source_url.not.is.null,source_note.not.is.null")
    .order("created_at", { ascending: false });

  return { data: normalizeMapProperties((data ?? []) as MapPropertyRow[]), error };
}

function MapPinLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-2 left-2 z-[400] rounded-md border border-neutral-200 bg-white/90 px-2 py-1.5 text-xs shadow-sm backdrop-blur ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="text-neutral-600">Rental</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-neutral-600">You</span>
      </div>
    </div>
  );
}

export default function RenterMapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [renterId, setRenterId] = useState<string | null>(null);
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [focusedMapCenter, setFocusedMapCenter] = useState<[number, number] | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [zoneBounds, setZoneBounds] = useState<MapBounds | null>(null);
  const [currentMapZoom, setCurrentMapZoom] = useState<number | null>(null);
  const [mapTargetZoom, setMapTargetZoom] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [zoneSearchState, setZoneSearchState] =
    useState<ZoneSearchState>("idle");
  const [zoneResultsOpen, setZoneResultsOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState("Cabadbaran map search");
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchError, setSaveSearchError] = useState<string | null>(null);
  const [saveSearchSuccess, setSaveSearchSuccess] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [previewPropertyId, setPreviewPropertyId] = useState<string | null>(null);
  const [detailsPropertyId, setDetailsPropertyId] = useState<string | null>(null);
  const [activeImagePath, setActiveImagePath] = useState<string | null>(null);
  const [lightboxImagePath, setLightboxImagePath] = useState<string | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const zoneLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (zoneLoadingTimerRef.current) {
        clearTimeout(zoneLoadingTimerRef.current);
      }
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

      const { data, error: propertiesError } =
        await fetchVerifiedMapProperties(client);

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

  const visibleMapProperties = useMemo(
    () =>
      zoneBounds
        ? mapProperties.filter((property) =>
            isPropertyInsideBounds(property, zoneBounds),
          )
        : mapProperties,
    [mapProperties, zoneBounds],
  );

  const zoneTypeCounts = useMemo(
    () =>
      Array.from(
        visibleMapProperties.reduce((counts, property) => {
          const type = property.property_type || "Rental";
          counts.set(type, (counts.get(type) ?? 0) + 1);
          return counts;
        }, new globalThis.Map<string, number>()),
      )
        .map(([type, count]) => ({ type, count }))
        .sort((first, second) => second.count - first.count || first.type.localeCompare(second.type)),
    [visibleMapProperties],
  );

  const initialListingCenter = useMemo<[number, number]>(() => {
    const first = mapProperties[0];
    return first ? [first.lat!, first.lng!] : DEFAULT_CENTER;
  }, [mapProperties]);

  const displayedMapCenter = hasUserLocation
    ? mapCenter
    : focusedMapCenter ?? initialListingCenter;
  const defaultMapZoom = hasUserLocation ? 13 : mapProperties.length > 0 ? 12 : 2;
  const targetMapZoom = mapTargetZoom ?? defaultMapZoom;
  const displayedMapZoom = currentMapZoom ?? targetMapZoom;
  const userLocation = hasUserLocation ? mapCenter : null;

  const cityCount = useMemo(
    () =>
      new Set(
        visibleMapProperties
          .map((property) => formatLocation(property))
          .filter((location) => location),
      ).size,
    [visibleMapProperties],
  );

  const averagePrice = useMemo(() => {
    const pricedProperties = visibleMapProperties.filter(
      (property) => typeof property.price === "number",
    );
    if (pricedProperties.length === 0) return null;
    const total = pricedProperties.reduce(
      (sum, property) => sum + (property.price ?? 0),
      0,
    );
    return Math.round(total / pricedProperties.length);
  }, [visibleMapProperties]);

  const savedSearchCity = useMemo(() => {
    const cities = Array.from(
      new Set(
        mapProperties
          .map((property) => normalizeOptionalText(property.city))
          .filter((city): city is string => Boolean(city)),
      ),
    );

    return cities.length === 1 ? cities[0] : null;
  }, [mapProperties]);

  const previewProperty = useMemo(
    () =>
      visibleMapProperties.find((property) => property.id === previewPropertyId) ??
      mapProperties.find((property) => property.id === previewPropertyId) ??
      null,
    [mapProperties, previewPropertyId, visibleMapProperties],
  );

  const detailsProperty = useMemo(
    () =>
      visibleMapProperties.find((property) => property.id === detailsPropertyId) ??
      mapProperties.find((property) => property.id === detailsPropertyId) ??
      null,
    [detailsPropertyId, mapProperties, visibleMapProperties],
  );

  const detailsImages = useMemo(
    () => getPropertyImages(detailsProperty),
    [detailsProperty],
  );
  const previewImages = useMemo(
    () => getPropertyImages(previewProperty),
    [previewProperty],
  );
  const previewCover = previewImages[0]?.storage_path ?? null;
  const detailsHeroImage =
    activeImagePath && detailsImages.some((image) => image.storage_path === activeImagePath)
      ? activeImagePath
      : detailsImages[0]?.storage_path ?? null;
  const detailsAmenities = useMemo(
    () => getAmenityNames(detailsProperty),
    [detailsProperty],
  );

  const onZoneChange = (bounds: MapBounds | null) => {
    if (zoneLoadingTimerRef.current) {
      clearTimeout(zoneLoadingTimerRef.current);
      zoneLoadingTimerRef.current = null;
    }

    if (!bounds) {
      setZoneBounds(null);
      setDrawMode(false);
      setZoneSearchState("idle");
      setZoneResultsOpen(false);
      return;
    }

    setZoneBounds(bounds);
    setDrawMode(false);
    setZoneSearchState("loading");
    setZoneResultsOpen(true);

    zoneLoadingTimerRef.current = setTimeout(() => {
      setZoneSearchState("complete");
      zoneLoadingTimerRef.current = null;
    }, ZONE_SEARCH_DELAY_MS);
  };

  const onStartDrawingZone = () => {
    if (zoneLoadingTimerRef.current) {
      clearTimeout(zoneLoadingTimerRef.current);
      zoneLoadingTimerRef.current = null;
    }

    setDrawMode(true);
    setZoneSearchState("idle");
    setZoneResultsOpen(false);
    setSaveSearchError(null);
    setSaveSearchSuccess(null);
  };

  const onClearZone = () => {
    if (zoneLoadingTimerRef.current) {
      clearTimeout(zoneLoadingTimerRef.current);
      zoneLoadingTimerRef.current = null;
    }

    setZoneBounds(null);
    setDrawMode(false);
    setZoneSearchState("idle");
    setZoneResultsOpen(false);
  };

  const onZoomToListing = (property: MapProperty) => {
    if (typeof property.lat !== "number" || typeof property.lng !== "number") {
      return;
    }

    setHasUserLocation(false);
    setFocusedMapCenter([property.lat, property.lng]);
    setMapTargetZoom(16.5);
    setCurrentMapZoom(16.5);
    setSelectedPropertyId(property.id);
    setPreviewPropertyId(property.id);
  };

  const onMapPropertySelect = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setPreviewPropertyId(null);
  };

  const onMapPropertyPreviewReady = (propertyId: string) => {
    setPreviewPropertyId(propertyId);
  };

  const openPropertyDetails = (property: MapProperty) => {
    const images = getPropertyImages(property);
    setDetailsPropertyId(property.id);
    setActiveImagePath(images[0]?.storage_path ?? null);
  };

  const closeLightbox = () => {
    setLightboxImagePath(null);
    setLightboxZoomed(false);
  };

  const onSaveSearch = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setSaveSearchError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    if (!renterId) {
      setSaveSearchError("You must be signed in as a renter to save searches.");
      return;
    }

    const name = savedSearchName.trim();
    if (!name) {
      setSaveSearchError("Name this search before saving it.");
      return;
    }

    const payload: SavedSearchInsert = {
      renter_id: renterId,
      name,
      query: null,
      city: savedSearchCity,
      property_type: null,
      min_price: null,
      max_price: null,
      map_bounds: zoneBounds ?? mapBounds,
    };

    const hasCriteria = Boolean(
      payload.query ||
        payload.city ||
        payload.property_type ||
        payload.min_price !== null ||
        payload.max_price !== null ||
        payload.map_bounds,
    );

    if (!hasCriteria) {
      setSaveSearchError("Move the map or apply a filter before saving this search.");
      return;
    }

    setSavingSearch(true);
    setSaveSearchError(null);
    setSaveSearchSuccess(null);

    const { data: existingSearch, error: lookupError } = await client
      .from("renter_saved_searches")
      .select("id")
      .eq("renter_id", renterId)
      .eq("name", name)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      setSaveSearchError(formatSavedSearchError(lookupError));
      setSavingSearch(false);
      return;
    }

    if (existingSearch) {
      setSaveSearchError("You already have a saved search with this name.");
      setSavingSearch(false);
      return;
    }

    const { data: savedSearch, error: insertError } = await client
      .from("renter_saved_searches")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setSaveSearchError(formatSavedSearchError(insertError));
      setSavingSearch(false);
      return;
    }

    if (!savedSearch) {
      setSaveSearchError("Saved search could not be confirmed.");
      setSavingSearch(false);
      return;
    }

    setSaveSearchSuccess("Search saved.");
    setSavingSearch(false);
  };

  const onUseLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not available in this browser.");
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setFocusedMapCenter(null);
        setMapTargetZoom(13);
        setCurrentMapZoom(13);
        setHasUserLocation(true);
      },
      () => {
        setLocationError("Unable to access your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onRequestMapFullscreen = () => {
    const mapElement = document.getElementById("renter-map-panel");
    if (!mapElement?.requestFullscreen) {
      return;
    }

    void mapElement.requestFullscreen().catch(() => undefined);
  };

  const showZoneResultsPanel = zoneResultsOpen || zoneSearchState !== "idle";

  const renderZoneResultsPanel = (placement: "sidebar" | "fullscreen") => {
    if (!showZoneResultsPanel) {
      return null;
    }

    const isFullscreenPanel = placement === "fullscreen";

    return (
      <div
        className={
          isFullscreenPanel
            ? "renter-zone-results-fullscreen pointer-events-auto absolute bottom-4 right-4 z-[420] hidden max-h-[calc(100%-7rem)] w-[min(22rem,calc(100%-2rem))] overflow-y-auto rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur"
            : "rounded-lg border border-neutral-200 bg-white p-4"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Drawn zone
            </p>
            <h2 className="mt-1 text-base font-semibold text-neutral-950">
              Zone Results
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {zoneSearchState === "loading"
                ? "Searching rentals inside selected area..."
                : `Found ${visibleMapProperties.length} rental${
                    visibleMapProperties.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
          <Badge variant={zoneSearchState === "loading" ? "info" : "success"}>
            {zoneSearchState === "loading" ? "Searching" : "Complete"}
          </Badge>
        </div>

        {zoneSearchState === "loading" ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-4 text-sm font-medium text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Searching rentals inside selected area...
          </div>
        ) : visibleMapProperties.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center">
            <Building2 className="mx-auto h-5 w-5 text-neutral-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-950">
              No rentals found inside this zone.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Try drawing a larger area.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              {zoneTypeCounts.map(({ type, count }) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-neutral-700">{type}</span>
                  <Badge>{count}</Badge>
                </div>
              ))}
            </div>

            <div
              className={`mt-4 space-y-2 overflow-y-auto pr-1 ${
                isFullscreenPanel ? "max-h-72" : "max-h-[32vh]"
              }`}
            >
              {visibleMapProperties.map((property) => (
                <article
                  key={property.id}
                  className="rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <h3 className="line-clamp-1 text-sm font-semibold text-neutral-950">
                    {property.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-neutral-700">
                    {formatPrice(property.price)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {formatAddress(property) || "Location unavailable"}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/dashboard/renter?property=${encodeURIComponent(property.id)}`,
                        )
                      }
                      className="w-full"
                    >
                      View Details
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onZoomToListing(property)}
                      className="w-full"
                    >
                      Zoom To Listing
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClearZone}
          className="mt-4 w-full"
        >
          Clear Zone
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="Nestora">
        <div className="mx-auto max-w-[1800px] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
            <Skeleton className="h-[70vh] min-h-[560px] w-full" />
            <div className="space-y-2">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
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
      className="px-3 py-3 pb-5 sm:px-4 lg:px-5"
    >
      <div className="mx-auto max-w-[1800px] space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Mapped rentals
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
              Browse rentals on the map
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={onUseLocation} variant="secondary" size="sm">
              {hasUserLocation ? (
                <Navigation className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              {hasUserLocation ? "Using your area" : "Use my location"}
            </Button>
          </div>
        </div>

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {locationError ? (
          <AlertMessage variant="warning">{locationError}</AlertMessage>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 md:grid-cols-4">
          {[
            {
              label: "Mapped rentals",
              value: visibleMapProperties.length,
              detail:
                visibleMapProperties.length === 0
                  ? "No listings yet"
                  : zoneBounds
                    ? `${visibleMapProperties.length} inside zone`
                    : `${visibleMapProperties.length} coordinate-ready`,
            },
            {
              label: "Areas covered",
              value: cityCount,
              detail:
                cityCount === 1
                  ? "1 area"
                  : cityCount > 0
                    ? `${cityCount} areas`
                    : "No areas yet",
            },
            {
              label: "Avg. price",
              value: averagePrice === null ? "N/A" : formatPrice(averagePrice),
              detail: averagePrice === null ? "No data" : "Per mo",
            },
            {
              label: "Near you",
              value: hasUserLocation ? "On" : "--",
              detail: hasUserLocation ? "Location enabled" : "Enable location",
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="text-[0.68rem] font-medium uppercase tracking-wide text-neutral-400">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                {stat.value}
              </p>
              <p className="text-xs text-neutral-500">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-neutral-700">
            <SlidersHorizontal className="h-4 w-4 text-neutral-500" aria-hidden="true" />
            Filter:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" className="px-3 py-1">
              Approved only
            </Badge>
            <Badge variant="info" className="px-3 py-1">
              Valid coordinates
            </Badge>
            <Badge variant="success" className="px-3 py-1">
              Verified Cabadbaran
            </Badge>
            {zoneBounds ? (
              <Badge variant="info" className="px-3 py-1">
                Drawn zone
              </Badge>
            ) : null}
            <Badge className="px-3 py-1 text-neutral-500 opacity-70">
              Price range
            </Badge>
            <Badge className="px-3 py-1 text-neutral-500 opacity-70">
              Bedrooms
            </Badge>
            <Badge className="px-3 py-1 text-neutral-500 opacity-70">
              Pet-friendly
            </Badge>
          </div>
        </div>

        <section
          aria-label="Approved rental map and list"
          className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]"
        >
          <div
            id="renter-map-panel"
            className="relative overflow-hidden rounded-lg border border-neutral-200 bg-[#e9e4d8]"
          >
            <div className="absolute right-4 top-4 z-[410] flex flex-wrap items-center justify-end gap-2">
              <div className="rounded-full border border-neutral-200 bg-white/95 px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur">
                Zoom {formatZoom(displayedMapZoom)}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRequestMapFullscreen}
                aria-label="Open map fullscreen"
                className="bg-white/95 shadow-sm backdrop-blur"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Fullscreen
              </Button>
            </div>
            {drawMode ? (
              <div className="pointer-events-none absolute left-4 top-4 z-[410] max-w-xs rounded-lg border border-blue-200 bg-white/95 px-3 py-2 text-sm font-medium text-blue-800 shadow-sm backdrop-blur">
                Click and drag to select an area.
              </div>
            ) : null}
            {zoneBounds ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClearZone}
                className="absolute left-4 top-4 z-[410] bg-white/95 shadow-sm backdrop-blur"
              >
                Clear zone
              </Button>
            ) : null}
            {mapProperties.length === 0 ? (
              <div className="relative h-[70vh] min-h-[560px] w-full overflow-hidden bg-[#e9e4d8]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-70"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(201,195,181,.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(201,195,181,.45) 1px, transparent 1px)",
                    backgroundSize: "23% 24%",
                  }}
                />
                <div className="absolute left-5 top-5 z-[1] max-w-xl rounded-lg border border-blue-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                  <div className="flex gap-3">
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-700">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-950">
                        No rentals are ready for the map yet
                      </p>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">
                        This map only shows approved, source-verified Cabadbaran
                        accommodations with valid latitude and longitude. Listings
                        without verified coordinates stay hidden from map pins.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-xl font-semibold text-neutral-400">
                      Map loads when listings have coordinates
                    </p>
                    <p className="mt-2 text-sm text-neutral-400">
                      Verified rentals will appear as pins here.
                    </p>
                  </div>
                </div>
                <MapPinLegend className="absolute bottom-2 left-2 z-[1]" />
              </div>
            ) : (
              <>
                <MapLibreRentalMap
                  center={displayedMapCenter}
                  zoom={targetMapZoom}
                  userLocation={userLocation}
                  properties={visibleMapProperties}
                  onZoomChange={setCurrentMapZoom}
                  onBoundsChange={setMapBounds}
                  selectedPropertyId={selectedPropertyId}
                  onPropertySelect={onMapPropertySelect}
                  onPropertyPreviewReady={onMapPropertyPreviewReady}
                  drawMode={drawMode}
                  zoneBounds={zoneBounds}
                  onZoneChange={onZoneChange}
                  className="renter-map-canvas h-[70vh] min-h-[560px] w-full"
                />
                {zoneSearchState === "loading" ? (
                  <div className="pointer-events-none absolute inset-0 z-[415] flex items-center justify-center bg-white/20 px-4">
                    <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white/95 px-4 py-3 text-sm font-medium text-blue-800 shadow-lg backdrop-blur">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Searching rentals inside selected area...
                    </div>
                  </div>
                ) : null}
                <MapPinLegend className="pointer-events-none absolute bottom-2 left-2 z-[400] max-w-[calc(100%-2rem)]" />
                {previewProperty ? (
                  <article className="renter-map-preview-card pointer-events-auto absolute bottom-4 right-4 z-[430] w-[min(23rem,calc(100%-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
                    <div className="grid grid-cols-[104px_minmax(0,1fr)]">
                      <button
                        type="button"
                        className="relative h-full min-h-32 overflow-hidden bg-neutral-100 text-neutral-500"
                        onClick={() =>
                          previewCover ? setLightboxImagePath(previewCover) : undefined
                        }
                        aria-label={
                          previewCover
                            ? `Open photo for ${previewProperty.title}`
                            : "No property photo available"
                        }
                      >
                        {previewCover ? (
                          <>
                            <img
                              src={previewCover}
                              alt={previewProperty.title}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-2 right-2 rounded-full bg-black/70 p-1.5 text-white">
                              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full min-h-32 items-center justify-center">
                            <ImageIcon className="h-6 w-6" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                      <div className="min-w-0 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-medium uppercase tracking-wide text-blue-600">
                              Selected rental
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-5 text-neutral-950">
                              {previewProperty.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewPropertyId(null)}
                            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label="Close property preview"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-2 line-clamp-1 text-sm text-neutral-500">
                          {formatAddress(previewProperty) || "Location unavailable"}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-medium uppercase text-neutral-400">Price</p>
                            <p className="mt-0.5 font-semibold text-neutral-950">
                              {formatPrice(previewProperty.price)}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium uppercase text-neutral-400">Type</p>
                            <p className="mt-0.5 line-clamp-1 font-semibold text-neutral-950">
                              {previewProperty.property_type || "Rental"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Badge variant="success">
                            {formatVerificationStatus(previewProperty.verification_status)}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openPropertyDetails(previewProperty)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ) : null}
                {renderZoneResultsPanel("fullscreen")}
              </>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            {renderZoneResultsPanel("sidebar")}

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-950">
                    Nearby listings
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Verified Cabadbaran accommodations with approved map coordinates.
                  </p>
                </div>
                <Badge>{visibleMapProperties.length} total</Badge>
              </div>

              <div className="mt-4">
                <label htmlFor="nearby-listing-search" className="sr-only">
                  Search nearby listings
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="nearby-listing-search"
                    placeholder="Search area..."
                    disabled
                    className="pl-9"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Local search within the visible map area is disabled.
                </p>
              </div>

              {visibleMapProperties.length === 0 ? (
                <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center">
                  <Building2 className="mx-auto h-5 w-5 text-neutral-400" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-semibold text-neutral-950">
                    {zoneBounds
                      ? "No rentals found inside this zone."
                      : "No coordinate-ready rentals yet"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                    {zoneBounds
                      ? "Clear the zone or draw a wider area to see rentals again."
                      : "They will appear here once approved, verified listings include valid map coordinates."}
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-[calc(70vh-170px)] min-h-[240px] space-y-2 overflow-y-auto pr-1">
                  {visibleMapProperties.map((property, index) => (
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
                              {formatAddress(property) || "Location unavailable"}
                            </span>
                          </p>
                        </div>
                        <Badge variant="success">
                          {formatVerificationStatus(property.verification_status)}
                        </Badge>
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
                            {property.property_type || "Rental"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-600">
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-950">
                      Save a search
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Save the current Cabadbaran map area and filters for later.
                    </p>
                  </div>
                </div>
                <Badge>Renter</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {saveSearchError ? (
                  <AlertMessage variant="danger">{saveSearchError}</AlertMessage>
                ) : null}
                {saveSearchSuccess ? (
                  <AlertMessage variant="success">{saveSearchSuccess}</AlertMessage>
                ) : null}
                <label htmlFor="saved-search-name" className="sr-only">
                  Saved search name
                </label>
                <Input
                  id="saved-search-name"
                  value={savedSearchName}
                  onChange={(event) => {
                    setSavedSearchName(event.target.value);
                    setSaveSearchError(null);
                    setSaveSearchSuccess(null);
                  }}
                  placeholder="Search name"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={onSaveSearch}
                  disabled={savingSearch}
                >
                  {savingSearch ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                  )}
                  Save this search
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-neutral-600">
                    <PencilRuler className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-950">
                      Draw a zone
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Draw a rectangle on the map to filter rentals inside it.
                    </p>
                  </div>
                </div>
                <Badge>{zoneBounds ? "Active" : drawMode ? "Drawing" : "Ready"}</Badge>
              </div>
              {drawMode ? (
                <AlertMessage variant="info" className="mt-4">
                  Click and drag to select an area.
                </AlertMessage>
              ) : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onStartDrawingZone}
                  disabled={drawMode}
                  className="w-full"
                >
                  <PencilRuler className="h-4 w-4" aria-hidden="true" />
                  Draw zone
                </Button>
                {zoneBounds ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClearZone}
                    className="w-full"
                  >
                    Clear zone
                  </Button>
                ) : null}
              </div>
            </div>
          </aside>
        </section>
        {detailsProperty ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="renter-property-drawer-backdrop absolute inset-0 bg-black/40"
              onClick={() => setDetailsPropertyId(null)}
              aria-label="Close property details"
            />
            <aside className="renter-property-drawer absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Property details
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight text-neutral-950">
                    {detailsProperty.title}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">
                      {formatAddress(detailsProperty) || "Location unavailable"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsPropertyId(null)}
                  className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label="Close property details"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="space-y-6 px-4 py-5 sm:px-6">
                  <section aria-label="Property gallery" className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                      {detailsHeroImage ? (
                        <button
                          type="button"
                          className="group relative block h-72 w-full overflow-hidden sm:h-96"
                          onClick={() => setLightboxImagePath(detailsHeroImage)}
                          aria-label={`Open gallery image for ${detailsProperty.title}`}
                        >
                          <img
                            src={detailsHeroImage}
                            alt={detailsProperty.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white shadow">
                            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                            Open
                          </span>
                        </button>
                      ) : (
                        <div className="flex h-72 items-center justify-center text-neutral-500 sm:h-96">
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-9 w-9" aria-hidden="true" />
                            <p className="mt-2 text-sm">No property photos yet</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        {detailsImages.length > 0
                          ? `${detailsImages.length} image${detailsImages.length === 1 ? "" : "s"}`
                          : "No images"}
                      </div>
                      <Badge variant="success">
                        {formatVerificationStatus(detailsProperty.verification_status)}
                      </Badge>
                    </div>
                    {detailsImages.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {detailsImages.map((image) => (
                          <button
                            key={image.storage_path}
                            type="button"
                            onClick={() => setActiveImagePath(image.storage_path)}
                            className={`h-20 w-24 shrink-0 overflow-hidden rounded-lg border transition ${
                              detailsHeroImage === image.storage_path
                                ? "border-neutral-950"
                                : "border-neutral-200 hover:border-neutral-400"
                            }`}
                            aria-label="Select gallery image"
                          >
                            <img
                              src={image.storage_path}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="grid gap-3 sm:grid-cols-3" aria-label="Property summary">
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-medium uppercase text-neutral-400">Price</p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {formatPrice(detailsProperty.price)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-medium uppercase text-neutral-400">Type</p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {detailsProperty.property_type || "Rental"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-medium uppercase text-neutral-400">Available</p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {formatDate(detailsProperty.available_from)}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-2" aria-label="Description">
                    <h3 className="text-base font-semibold text-neutral-950">Description</h3>
                    <p className="text-sm leading-6 text-neutral-600">
                      {detailsProperty.description?.trim() || "No description provided."}
                    </p>
                  </section>

                  <section className="space-y-3" aria-label="Amenities">
                    <h3 className="text-base font-semibold text-neutral-950">Amenities</h3>
                    {detailsAmenities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {detailsAmenities.map((amenity) => (
                          <Badge key={amenity}>{amenity}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                        No amenities listed.
                      </p>
                    )}
                  </section>

                  <section className="grid gap-3 sm:grid-cols-2" aria-label="Terms">
                    <div className="rounded-lg border border-neutral-200 p-3">
                      <p className="text-xs font-medium uppercase text-neutral-400">Deposit</p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {formatPrice(detailsProperty.deposit)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 p-3">
                      <p className="text-xs font-medium uppercase text-neutral-400">
                        Advance payment
                      </p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {formatPrice(detailsProperty.advance)}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3" aria-label="Reviews">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-neutral-950">Reviews</h3>
                      <Badge>
                        {(detailsProperty.reviews ?? []).length} total
                      </Badge>
                    </div>
                    {(detailsProperty.reviews ?? []).length === 0 ? (
                      <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                        No reviews yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {(detailsProperty.reviews ?? []).map((review) => (
                          <li
                            key={review.id}
                            className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-1 font-semibold text-neutral-950">
                                <Star className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
                                {review.rating}/5
                              </span>
                              <span className="text-xs text-neutral-500">
                                {new Date(review.created_at).toLocaleDateString()}
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
                  </section>
                </div>
              </div>

              <div className="shrink-0 border-t border-neutral-200 bg-white p-4 sm:px-6">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() =>
                    router.push(
                      `/dashboard/renter?property=${encodeURIComponent(detailsProperty.id)}`,
                    )
                  }
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Open inquiry form
                </Button>
              </div>
            </aside>
          </div>
        ) : null}

        {lightboxImagePath ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
            <button
              type="button"
              className="absolute inset-0"
              onClick={closeLightbox}
              aria-label="Close image viewer"
            />
            <div className="renter-lightbox relative z-10 max-h-full max-w-6xl">
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute -right-2 -top-12 rounded-full bg-white/95 p-2 text-neutral-800 shadow hover:bg-white"
                aria-label="Close image viewer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoomed((value) => !value)}
                className="block max-h-[82vh] max-w-full overflow-auto rounded-xl bg-black"
                aria-label={lightboxZoomed ? "Zoom image out" : "Zoom image in"}
              >
                <img
                  src={lightboxImagePath}
                  alt=""
                  className={`max-h-[82vh] max-w-full object-contain transition-transform duration-300 ${
                    lightboxZoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"
                  }`}
                />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
