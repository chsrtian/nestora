"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/logout-button";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
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

  useEffect(() => {
    if (hasUserLocation) return;
    if (properties.length === 0) return;

    const first = properties[0];
    if (typeof first.lat === "number" && typeof first.lng === "number") {
      setMapCenter([first.lat, first.lng]);
      setMapZoom(12);
    }
  }, [properties, hasUserLocation]);

  const mapProperties = useMemo(
    () =>
      properties.filter(
        (property) =>
          typeof property.lat === "number" &&
          typeof property.lng === "number" &&
          Number.isFinite(property.lat) &&
          Number.isFinite(property.lng),
      ),
    [properties],
  );

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
      <main>
        <p>Loading renter map...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Renter Map</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: renter</p>

      <section aria-label="Location">
        <button type="button" onClick={onUseLocation}>
          Use my location
        </button>
        {locationError ? <p role="alert">{locationError}</p> : null}
      </section>

      <section aria-label="Map">
        <h2>Approved properties on the map</h2>
        {mapProperties.length === 0 ? (
          <p>No approved properties with coordinates are available yet.</p>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            style={{ height: "420px", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapProperties.map((property) => (
              <Marker key={property.id} position={[property.lat!, property.lng!]}>
                <Popup>
                  <strong>{property.title}</strong>
                  <div>
                    {property.city || ""}
                    {property.state ? `, ${property.state}` : ""}
                    {property.country ? `, ${property.country}` : ""}
                  </div>
                  <div>Price: {property.price}</div>
                  <div>Type: {property.property_type || "Not specified"}</div>
                  <div>Deposit: {property.deposit}</div>
                  <div>Advance: {property.advance}</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </section>

      <section aria-label="Property list">
        <h2>Property list</h2>
        {mapProperties.length === 0 ? (
          <p>No approved properties with coordinates are available yet.</p>
        ) : (
          <ul>
            {mapProperties.map((property) => (
              <li key={property.id}>
                <strong>{property.title}</strong> - {property.city || ""}
                {property.state ? `, ${property.state}` : ""}
                {property.country ? `, ${property.country}` : ""} | Price:
                {" "}{property.price} | Type:{" "}
                {property.property_type || "Not specified"} | Deposit:{" "}
                {property.deposit} | Advance: {property.advance}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>
        Testing note: Until admin approval is implemented, manually approve a
        property in Supabase using{` update properties set status = 'approved' where id = '';`}
        . Properties must also have valid lat/lng values to appear on the map.
      </p>

      <LogoutButton />
    </main>
  );
}
