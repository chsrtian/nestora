"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  MapMouseEvent,
} from "maplibre-gl";

export const MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

type LatLng = [number, number];

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type LngLat = {
  lng: number;
  lat: number;
};

export type MapRental = {
  id: string;
  title: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  price: number | null;
  property_type: string | null;
  deposit: number | null;
  advance: number | null;
  lat: number | null;
  lng: number | null;
  verification_status: "verified" | "needs_verification" | "incomplete" | null;
  source_url: string | null;
  source_note: string | null;
};

type MapLibreRentalMapProps = {
  properties: MapRental[];
  center: LatLng;
  zoom: number;
  userLocation: LatLng | null;
  onZoomChange: (zoom: number) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  selectedPropertyId?: string | null;
  onPropertySelect?: (propertyId: string) => void;
  onPropertyPreviewReady?: (propertyId: string) => void;
  drawMode: boolean;
  zoneBounds: MapBounds | null;
  onZoneChange: (bounds: MapBounds | null) => void;
  className?: string;
  style?: CSSProperties;
};

const ZONE_SOURCE_ID = "renter-draw-zone";
const ZONE_FILL_LAYER_ID = "renter-draw-zone-fill";
const ZONE_LINE_LAYER_ID = "renter-draw-zone-line";

function toLngLat([lat, lng]: LatLng): [number, number] {
  return [lng, lat];
}

function getMapBounds(map: MapLibreMap): MapBounds {
  const bounds = map.getBounds();
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

function normalizeBounds(start: LngLat, end: LngLat): MapBounds {
  return {
    north: Math.max(start.lat, end.lat),
    south: Math.min(start.lat, end.lat),
    east: Math.max(start.lng, end.lng),
    west: Math.min(start.lng, end.lng),
  };
}

function isUsableBounds(bounds: MapBounds) {
  return (
    Math.abs(bounds.east - bounds.west) > 0.00001 &&
    Math.abs(bounds.north - bounds.south) > 0.00001
  );
}

function boundsToFeatureCollection(bounds: MapBounds | null) {
  if (!bounds) {
    return {
      type: "FeatureCollection" as const,
      features: [],
    };
  }

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.south],
              [bounds.east, bounds.north],
              [bounds.west, bounds.north],
              [bounds.west, bounds.south],
            ],
          ],
        },
      },
    ],
  };
}

function createRentalMarker(property: MapRental) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.dataset.propertyId = property.id;
  marker.dataset.propertyTitle = property.title;
  marker.setAttribute("aria-label", `Open ${property.title}`);
  marker.className =
    "renter-map-marker relative h-7 w-7 cursor-pointer rounded-full border-2 border-white bg-blue-500 shadow-lg ring-2 ring-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-200";
  return marker;
}

function createUserMarker() {
  const marker = document.createElement("div");
  marker.setAttribute("aria-label", "Your area");
  marker.className =
    "h-7 w-7 rounded-full border-2 border-white bg-green-500 shadow-lg ring-2 ring-green-100";
  return marker;
}

export function MapLibreRentalMap({
  properties,
  center,
  zoom,
  userLocation,
  onZoomChange,
  onBoundsChange,
  selectedPropertyId,
  onPropertySelect,
  onPropertyPreviewReady,
  drawMode,
  zoneBounds,
  onZoneChange,
  className,
  style,
}: MapLibreRentalMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rentalMarkersRef = useRef<MapLibreMarker[]>([]);
  const rentalMarkerElementsRef = useRef<globalThis.Map<string, HTMLElement>>(
    new globalThis.Map(),
  );
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const selectedPropertyIdRef = useRef(selectedPropertyId);
  const onPropertySelectRef = useRef(onPropertySelect);
  const onPropertyPreviewReadyRef = useRef(onPropertyPreviewReady);
  const onZoneChangeRef = useRef(onZoneChange);
  const drawStartRef = useRef<LngLat | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onPropertySelectRef.current = onPropertySelect;
  }, [onPropertySelect]);

  useEffect(() => {
    onPropertyPreviewReadyRef.current = onPropertyPreviewReady;
  }, [onPropertyPreviewReady]);

  useEffect(() => {
    onZoneChangeRef.current = onZoneChange;
  }, [onZoneChange]);

  useEffect(() => {
    let cancelled = false;
    const markerElements = rentalMarkerElementsRef.current;

    const initialize = async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(initialCenterRef.current),
        zoom: initialZoomRef.current,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      map.on("zoom", () => {
        onZoomChangeRef.current(Math.round(map.getZoom() * 10) / 10);
      });
      map.on("moveend", () => {
        onBoundsChangeRef.current?.(getMapBounds(map));
      });
      map.on("load", () => {
        map.addSource(ZONE_SOURCE_ID, {
          type: "geojson",
          data: boundsToFeatureCollection(null),
        });
        map.addLayer({
          id: ZONE_FILL_LAYER_ID,
          type: "fill",
          source: ZONE_SOURCE_ID,
          paint: {
            "fill-color": "#2563eb",
            "fill-opacity": 0.12,
          },
        });
        map.addLayer({
          id: ZONE_LINE_LAYER_ID,
          type: "line",
          source: ZONE_SOURCE_ID,
          paint: {
            "line-color": "#2563eb",
            "line-width": 2,
            "line-dasharray": [2, 1],
          },
        });
        onZoomChangeRef.current(Math.round(map.getZoom() * 10) / 10);
        onBoundsChangeRef.current?.(getMapBounds(map));
        setMapReady(true);
      });

      mapRef.current = map;
    };

    void initialize();

    return () => {
      cancelled = true;
      rentalMarkersRef.current.forEach((marker) => marker.remove());
      userMarkerRef.current?.remove();
      rentalMarkersRef.current = [];
      markerElements.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    map.easeTo({
      center: toLngLat(center),
      zoom,
      duration: 450,
      essential: true,
    });
  }, [center, mapReady, zoom]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;

      map.resize();
      onBoundsChangeRef.current?.(getMapBounds(map));
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleFullscreenChange = () => {
      requestAnimationFrame(() => {
        map.resize();
        onBoundsChangeRef.current?.(getMapBounds(map));
      });
      window.setTimeout(() => {
        map.resize();
        onBoundsChangeRef.current?.(getMapBounds(map));
      }, 150);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(ZONE_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(boundsToFeatureCollection(zoneBounds));
  }, [mapReady, zoneBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = drawMode ? "crosshair" : "";

    if (drawMode) {
      map.dragPan.disable();
      map.doubleClickZoom.disable();
    } else {
      drawStartRef.current = null;
      map.dragPan.enable();
      map.doubleClickZoom.enable();
    }

    const updateDraftZone = (bounds: MapBounds | null) => {
      const source = map.getSource(ZONE_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(boundsToFeatureCollection(bounds));
    };

    const handleMouseDown = (event: MapMouseEvent) => {
      if (!drawMode) return;
      event.preventDefault();
      drawStartRef.current = { lng: event.lngLat.lng, lat: event.lngLat.lat };
      updateDraftZone(normalizeBounds(drawStartRef.current, drawStartRef.current));
    };

    const handleMouseMove = (event: MapMouseEvent) => {
      const start = drawStartRef.current;
      if (!drawMode || !start) return;
      updateDraftZone(normalizeBounds(start, { lng: event.lngLat.lng, lat: event.lngLat.lat }));
    };

    const handleMouseUp = (event: MapMouseEvent) => {
      const start = drawStartRef.current;
      if (!drawMode || !start) return;

      const bounds = normalizeBounds(start, {
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      });
      drawStartRef.current = null;

      if (isUsableBounds(bounds)) {
        onZoneChangeRef.current(bounds);
        updateDraftZone(bounds);
      } else {
        updateDraftZone(zoneBounds);
      }
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      drawStartRef.current = null;
      canvas.style.cursor = "";
      map.dragPan.enable();
      map.doubleClickZoom.enable();
    };
  }, [drawMode, mapReady, zoneBounds]);

  useEffect(() => {
    selectedPropertyIdRef.current = selectedPropertyId;
    rentalMarkerElementsRef.current.forEach((element, propertyId) => {
      const isSelected = propertyId === selectedPropertyId;
      element.classList.toggle("is-selected", isSelected);
      element.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }, [selectedPropertyId]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || !mapReady) return;
    const markerElements = rentalMarkerElementsRef.current;

    const markerEntries = properties.map((property) => {
      const element = createRentalMarker(property);
      const coordinates: [number, number] = [property.lng!, property.lat!];
      const isSelected = property.id === selectedPropertyIdRef.current;
      element.classList.toggle("is-selected", isSelected);
      element.setAttribute("aria-pressed", isSelected ? "true" : "false");
      markerElements.set(property.id, element);
      const marker = new maplibregl.Marker({
        anchor: "center",
        element,
      })
        .setLngLat(coordinates)
        .addTo(map);

      const selectProperty = () => {
        if (drawMode) return;

        onPropertySelectRef.current?.(property.id);

        const currentZoom = map.getZoom();
        const targetZoom = currentZoom >= 15.5 ? currentZoom : 15.5;
        const duration = 950;
        let completed = false;
        let fallbackTimer: number | null = null;

        const finish = () => {
          if (completed) return;
          completed = true;
          if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
          }
          map.off("moveend", finish);
          onBoundsChangeRef.current?.(getMapBounds(map));
          onPropertyPreviewReadyRef.current?.(property.id);
        };

        map.once("moveend", finish);
        fallbackTimer = window.setTimeout(finish, duration + 160);
        map.flyTo({
          center: coordinates,
          zoom: targetZoom,
          duration,
          essential: true,
        });
      };
      let lastActivationAt = 0;
      const selectPropertyOnce = () => {
        const now = performance.now();
        if (now - lastActivationAt < 150) {
          return;
        }

        lastActivationAt = now;
        selectProperty();
      };
      const onMarkerClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        selectPropertyOnce();
      };
      const onMarkerPointerUp = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        selectPropertyOnce();
      };
      const onMarkerKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        selectPropertyOnce();
      };
      const stopMapGesture = (event: Event) => {
        event.stopPropagation();
      };

      element.addEventListener("pointerdown", stopMapGesture);
      element.addEventListener("pointerup", onMarkerPointerUp);
      element.addEventListener("mousedown", stopMapGesture);
      element.addEventListener("mouseup", onMarkerPointerUp);
      element.addEventListener("touchstart", stopMapGesture);
      element.addEventListener("touchend", onMarkerPointerUp);
      element.addEventListener("dblclick", stopMapGesture);
      element.addEventListener("click", onMarkerClick);
      element.addEventListener("keydown", onMarkerKeyDown);

      return {
        element,
        marker,
        onMarkerClick,
        onMarkerKeyDown,
        onMarkerPointerUp,
        stopMapGesture,
      };
    });

    rentalMarkersRef.current = markerEntries.map(({ marker }) => marker);

    return () => {
      markerEntries.forEach(
        ({
          element,
          marker,
          onMarkerClick,
          onMarkerKeyDown,
          onMarkerPointerUp,
          stopMapGesture,
        }) => {
          element.removeEventListener("pointerdown", stopMapGesture);
          element.removeEventListener("pointerup", onMarkerPointerUp);
          element.removeEventListener("mousedown", stopMapGesture);
          element.removeEventListener("mouseup", onMarkerPointerUp);
          element.removeEventListener("touchstart", stopMapGesture);
          element.removeEventListener("touchend", onMarkerPointerUp);
          element.removeEventListener("dblclick", stopMapGesture);
          element.removeEventListener("click", onMarkerClick);
          element.removeEventListener("keydown", onMarkerKeyDown);
          marker.remove();
          markerElements.delete(element.dataset.propertyId ?? "");
        },
      );
      rentalMarkersRef.current = [];
    };
  }, [drawMode, mapReady, properties]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || !mapReady) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (userLocation) {
      userMarkerRef.current = new maplibregl.Marker({
        anchor: "center",
        element: createUserMarker(),
      })
        .setLngLat(toLngLat(userLocation))
        .addTo(map);
    }

    return () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [mapReady, userLocation]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={style}>
      <div
        ref={containerRef}
        aria-label="Approved rental map"
        className="absolute inset-0"
        role="region"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
