"use client";

import {
  getVersion,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
  type GeoJSONStoreFeatures,
  type HexColor,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useEffect, useRef } from "react";
import type { AreaKind, DrawnShape } from "@/lib/geo";

// Copied into /public by scripts/copy-maplibre-worker.mjs (predev / prebuild).
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export type Tool = AreaKind | "edit";

export type QuoteMapApi = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  setTool: (tool: Tool) => void;
  deleteSelected: () => void;
  clear: () => void;
};

type Props = {
  onReady: (api: QuoteMapApi) => void;
  onShapesChange: (shapes: DrawnShape[]) => void;
  onSelectionChange: (hasSelection: boolean) => void;
};

// Brunei-Muara district / Bandar Seri Begawan.
const BRUNEI_CENTER: [number, number] = [114.94, 4.89];
const BRUNEI_BOUNDS: [[number, number], [number, number]] = [
  [113.8, 3.8],
  [115.6, 5.3],
];

const SATELLITE_TILES =
  process.env.NEXT_PUBLIC_SATELLITE_TILE_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABEL_TILES =
  process.env.NEXT_PUBLIC_LABEL_TILE_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ??
  "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";

const MAP_STYLE: StyleSpecification = {
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

const COLORS: Record<AreaKind, { fill: HexColor; line: HexColor }> = {
  grass: { fill: "#4ade80", line: "#16a34a" },
  exclude: { fill: "#f87171", line: "#dc2626" },
};

function polygonMode(kind: AreaKind) {
  return new TerraDrawPolygonMode({
    modeName: kind,
    styles: {
      fillColor: COLORS[kind].fill,
      fillOpacity: 0.35,
      outlineColor: COLORS[kind].line,
      outlineWidth: 3,
      closingPointColor: "#ffffff",
      closingPointWidth: 7,
      closingPointOutlineColor: COLORS[kind].line,
      closingPointOutlineWidth: 2,
    },
    validation: (feature, { updateType }) =>
      updateType === "provisional" ? { valid: true } : ValidateNotSelfIntersecting(feature),
  });
}

const editFlags = {
  feature: {
    draggable: true,
    coordinates: { midpoints: true, draggable: true, deletable: true },
  },
};

function toShapes(snapshot: GeoJSONStoreFeatures[]): DrawnShape[] {
  return snapshot
    .filter(
      (f) =>
        f.geometry.type === "Polygon" &&
        (f.properties.mode === "grass" || f.properties.mode === "exclude"),
    )
    .map((f) => ({
      type: "Feature",
      properties: { kind: f.properties.mode as AreaKind },
      geometry: f.geometry as DrawnShape["geometry"],
    }));
}

export default function QuoteMap({ onReady, onShapesChange, onSelectionChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest callbacks without re-creating the map.
  const callbacks = useRef({ onReady, onShapesChange, onSelectionChange });
  useEffect(() => {
    callbacks.current = { onReady, onShapesChange, onSelectionChange };
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: BRUNEI_CENTER,
      zoom: 11,
      maxZoom: 21,
      maxBounds: BRUNEI_BOUNDS,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    let draw: TerraDraw | null = null;
    let selectedId: string | number | null = null;

    map.on("load", () => {
      draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          polygonMode("grass"),
          polygonMode("exclude"),
          new TerraDrawSelectMode({
            flags: { grass: editFlags, exclude: editFlags },
            styles: {
              selectedPolygonColor: "#facc15",
              selectedPolygonFillOpacity: 0.35,
              selectedPolygonOutlineColor: "#ca8a04",
              selectedPolygonOutlineWidth: 3,
              selectionPointColor: "#ffffff",
              selectionPointOutlineColor: "#ca8a04",
              selectionPointWidth: 6,
              midPointColor: "#fde68a",
              midPointOutlineColor: "#ca8a04",
            },
          }),
        ],
      });
      draw.start();
      draw.setMode("grass");

      const emit = () => {
        if (draw) callbacks.current.onShapesChange(toShapes(draw.getSnapshot()));
      };
      draw.on("finish", emit);
      draw.on("change", (_ids, type) => {
        // Edits in select mode and deletions; skip provisional drawing updates.
        if (type === "delete" || draw?.getMode() === "select") emit();
      });
      draw.on("select", (id) => {
        selectedId = id;
        callbacks.current.onSelectionChange(true);
      });
      draw.on("deselect", () => {
        selectedId = null;
        callbacks.current.onSelectionChange(false);
      });

      callbacks.current.onReady({
        flyTo: (lng, lat, zoom = 19) => map.flyTo({ center: [lng, lat], zoom, speed: 1.6 }),
        setTool: (tool) => draw?.setMode(tool === "edit" ? "select" : tool),
        deleteSelected: () => {
          if (draw && selectedId !== null) {
            const id = selectedId;
            draw.deselectFeature(id);
            draw.removeFeatures([id]);
            emit();
          }
        },
        clear: () => {
          draw?.clear();
          selectedId = null;
          callbacks.current.onSelectionChange(false);
          emit();
        },
      });
    });

    return () => {
      draw?.stop();
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" data-testid="quote-map" />;
}
