"use client";

import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
  type GeoJSONStoreFeatures,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useEffect, useRef } from "react";
import { shapesBounds, type AreaKind, type DrawnShape } from "@/lib/geo";
import { AREA_COLORS as COLORS, createBaseMap } from "./map/base";

export type Tool = AreaKind | "edit";

export type QuoteMapApi = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  setTool: (tool: Tool) => void;
  deleteSelected: () => void;
  clear: () => void;
  /** Restore previously drawn shapes (e.g. after signing in). */
  loadShapes: (shapes: DrawnShape[]) => void;
};

type Props = {
  onReady: (api: QuoteMapApi) => void;
  onShapesChange: (shapes: DrawnShape[]) => void;
  onSelectionChange: (hasSelection: boolean) => void;
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

    const map = createBaseMap(containerRef.current);

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
        loadShapes: (shapes) => {
          if (!draw) return;
          draw.clear();
          draw.addFeatures(
            shapes.map((s) => ({
              type: "Feature",
              geometry: s.geometry,
              properties: { mode: s.properties.kind },
            })),
          );
          const b = shapesBounds(shapes);
          if (b) map.fitBounds(b, { padding: 60, maxZoom: 20, duration: 0 });
          emit();
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
