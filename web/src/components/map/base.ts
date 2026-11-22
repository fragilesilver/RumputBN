"use client";

import {
  getVersion,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapOptions,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HexColor } from "terra-draw";
import { BRUNEI_BOUNDS, BRUNEI_CENTER, type AreaKind } from "@/lib/geo";

// Copied into /public by scripts/copy-maplibre-worker.mjs (predev / prebuild).
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

const SATELLITE_TILES =
  process.env.NEXT_PUBLIC_SATELLITE_TILE_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABEL_TILES =
  process.env.NEXT_PUBLIC_LABEL_TILE_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ??
  "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: ATTRIBUTION,
    },
    labels: { type: "raster", tiles: [LABEL_TILES], tileSize: 256, maxzoom: 19 },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#1f2a1f" } },
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels" },
  ],
};

export const AREA_COLORS: Record<AreaKind, { fill: HexColor; line: HexColor }> = {
  grass: { fill: "#4ade80", line: "#16a34a" },
  exclude: { fill: "#f87171", line: "#dc2626" },
};

/** A satellite map of Brunei with zoom buttons and rotation disabled. */
export function createBaseMap(
  container: HTMLElement,
  options: Partial<MapOptions> = {},
): MapLibreMap {
  const map = new MapLibreMap({
    container,
    style: MAP_STYLE,
    center: BRUNEI_CENTER,
    zoom: 11,
    maxZoom: 21,
    maxBounds: BRUNEI_BOUNDS,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    ...options,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  return map;
}
