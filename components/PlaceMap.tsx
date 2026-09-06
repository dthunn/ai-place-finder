"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
  type PaddingOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatOpeningHours } from "@/lib/format";

export interface MapPlace {
  id: number | string;
  name: string | null;
  category: string | null;
  search_text: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  cuisine: string | null;
  wheelchair: string | null;
  outdoor_seating: boolean | null;
  tags: Record<string, string>;
  lat: number;
  lon: number;
}

const OMAHA_CENTER: [number, number] = [-95.9345, 41.2565];
const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const LIGHT_MARKER_COLOR = "#e11d48";
const DARK_MARKER_COLOR = "#ff4fa3";
// OpenFreeMap's "dark" style has a dark background but keeps its label text
// in dark grays (meant for a light background elsewhere) — brighten it here.
const DARK_LABEL_COLOR = "#c0caf5";
const DARK_LABEL_HALO_COLOR = "rgba(10, 10, 18, 0.85)";
// The sidebar overlays the map rather than resizing it, so camera operations
// need padding on the left to stay visually centered in the visible area.
const SIDEBAR_WIDTH = 384;
const MAP_PADDING = 40;

// Turbopack can't resolve maplibre-gl's default worker URL (which relies on
// import.meta.url pointing at its own dist file), so it falls back to the
// page URL and the worker fails to load. Serve the worker as a static file instead.
setWorkerUrl("/maplibre-gl-worker.mjs");

function brightenDarkLabels(map: MapLibreMap) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
      map.setPaintProperty(layer.id, "text-color", DARK_LABEL_COLOR);
      map.setPaintProperty(layer.id, "text-halo-color", DARK_LABEL_HALO_COLOR);
      map.setPaintProperty(layer.id, "text-halo-width", 1);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function buildPopupHtml(place: MapPlace): string {
  const details: string[] = [];
  const badges: string[] = [];
  const tags = place.tags ?? {};

  const brand = tags.brand;
  if (brand && !(place.name && place.name.toLowerCase().includes(brand.toLowerCase()))) {
    details.push(`Brand: ${escapeHtml(brand)}`);
  }

  const addressLine = [place.address, [place.city, place.state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  if (addressLine) details.push(escapeHtml(addressLine));
  if (place.phone) details.push(escapeHtml(place.phone));
  if (place.opening_hours) details.push(escapeHtml(formatOpeningHours(place.opening_hours)));
  if (place.cuisine) details.push(`Cuisine: ${escapeHtml(place.cuisine.replace(/;/g, ", "))}`);
  if (place.wheelchair === "yes") details.push("Wheelchair accessible");
  else if (place.wheelchair === "limited") details.push("Limited wheelchair access");
  if (place.outdoor_seating) details.push("Outdoor seating");

  if (tags.internet_access === "yes" || tags.internet_access === "wlan") badges.push("Wifi");
  if (tags.takeaway === "yes" || tags.takeaway === "only") badges.push("Takeaway");
  if (tags.delivery === "yes") badges.push("Delivery");
  if (tags.drive_through === "yes") badges.push("Drive-through");

  const badgePill = (label: string) => `<span class="popup-badge">${escapeHtml(label)}</span>`;

  const blocks: string[] = [];

  blocks.push(`
    <div class="popup-title">${escapeHtml(place.name ?? "Unnamed place")}</div>
    ${place.category ? `<div class="popup-category">${escapeHtml(place.category)}</div>` : ""}
  `);

  const closeButtonHtml = `
    <button
      type="button"
      class="popup-close"
      onclick="this.closest('.maplibregl-popup').style.display='none'"
      aria-label="Close"
    ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
  `;

  if (place.search_text) {
    blocks.push(`<div class="popup-description">${escapeHtml(place.search_text)}</div>`);
  }

  if (details.length > 0) {
    blocks.push(`<div class="popup-details">${details.map((d) => `<div>${d}</div>`).join("")}</div>`);
  }

  if (badges.length > 0) {
    blocks.push(`<div class="popup-badges">${badges.map(badgePill).join("")}</div>`);
  }

  const bodyHtml = blocks.map((block) => `<div class="popup-block">${block}</div>`).join("");

  const websiteHtml =
    place.website && isSafeUrl(place.website)
      ? `<div class="popup-website">
          <a href="${escapeHtml(place.website)}" target="_blank" rel="noopener noreferrer" class="popup-website-link">Website ↗</a>
        </div>`
      : "";

  return `<div class="popup-card">${closeButtonHtml}${bodyHtml}${websiteHtml}</div>`;
}

function getPadding(sidebarOpen: boolean): PaddingOptions {
  return {
    top: MAP_PADDING,
    bottom: MAP_PADDING,
    right: MAP_PADDING,
    left: (sidebarOpen ? SIDEBAR_WIDTH : 0) + MAP_PADDING,
  };
}

export default function PlaceMap({ places, sidebarOpen }: { places: MapPlace[]; sidebarOpen: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const isDarkRef = useRef(isDark);
  const sidebarOpenRef = useRef(sidebarOpen);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // Create the map once, then swap its style in place when the theme changes
  // (avoids tearing down and recreating the map, which would reset the camera).
  useEffect(() => {
    if (!containerRef.current) return;
    const style = isDark ? DARK_STYLE : LIGHT_STYLE;

    if (!mapRef.current) {
      const map = new MapLibreMap({
        container: containerRef.current,
        style,
        center: OMAHA_CENTER,
        zoom: 11,
        attributionControl: false,
      });
      map.addControl(new NavigationControl(), "top-right");
      map.setPadding(getPadding(sidebarOpenRef.current));
      map.on("style.load", () => {
        if (isDarkRef.current) brightenDarkLabels(map);
      });
      mapRef.current = map;
    } else {
      mapRef.current.setStyle(style);
    }
  }, [isDark]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the camera visually centered in the space still visible once the
  // sidebar slides in/out over the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ padding: getPadding(sidebarOpen), duration: 300 });
  }, [sidebarOpen]);

  // Rebuild markers only when the actual result set changes — NOT on theme or
  // sidebar toggles, which would otherwise destroy any currently-open popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const markerColor = isDarkRef.current ? DARK_MARKER_COLOR : LIGHT_MARKER_COLOR;

    for (const place of places) {
      const marker = new Marker({ color: markerColor })
        .setLngLat([place.lon, place.lat])
        .setPopup(new Popup({ offset: 12, closeButton: false }).setHTML(buildPopupHtml(place)))
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [places]);

  // Fit the camera to the current results whenever the results or the
  // sidebar-obstructed viewport changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || places.length === 0) return;

    const bounds = new LngLatBounds();
    for (const place of places) {
      bounds.extend([place.lon, place.lat]);
    }

    map.fitBounds(bounds, { padding: getPadding(sidebarOpen), maxZoom: 15, duration: 0 });
  }, [places, sidebarOpen]);

  return <div ref={containerRef} className="h-full w-full" />;
}
