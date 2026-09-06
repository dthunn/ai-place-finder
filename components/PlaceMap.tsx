"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapPlace {
  id: number | string;
  name: string | null;
  lat: number;
  lon: number;
}

const OMAHA_CENTER: [number, number] = [-95.9345, 41.2565];
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Turbopack can't resolve maplibre-gl's default worker URL (which relies on
// import.meta.url pointing at its own dist file), so it falls back to the
// page URL and the worker fails to load. Serve the worker as a static file instead.
setWorkerUrl("/maplibre-gl-worker.mjs");

export default function PlaceMap({ places }: { places: MapPlace[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: OMAHA_CENTER,
      zoom: 11,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (places.length === 0) return;

    const bounds = new LngLatBounds();

    for (const place of places) {
      const marker = new Marker({ color: "#e11d48" })
        .setLngLat([place.lon, place.lat])
        .setPopup(new Popup({ offset: 12 }).setText(place.name ?? "Unnamed place"))
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([place.lon, place.lat]);
    }

    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
  }, [places]);

  return <div ref={containerRef} className="h-full w-full" />;
}
