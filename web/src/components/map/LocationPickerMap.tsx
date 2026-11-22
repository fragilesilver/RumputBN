"use client";

import { Marker, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { circlePolygon } from "@/lib/geo";
import { createBaseMap } from "./base";

type LngLat = { lng: number; lat: number };

type Props = {
  value: LngLat | null;
  radiusKm: number;
  onChange: (value: LngLat) => void;
};

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/** Tap the map (or drag the pin) to set a base location; shows the radius. */
export default function LocationPickerMap({ value, radiusKm, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const loadedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const initial = useRef({ value, radiusKm });

  useEffect(() => {
    if (!containerRef.current) return;
    const start = initial.current.value;
    const map = createBaseMap(containerRef.current, {
      ...(start ? { center: [start.lng, start.lat], zoom: 11 } : { zoom: 9.5 }),
    });
    mapRef.current = map;

    const marker = new Marker({ color: "#15803d", draggable: true });
    markerRef.current = marker;
    marker.on("dragend", () => onChangeRef.current(marker.getLngLat()));
    if (start) marker.setLngLat([start.lng, start.lat]).addTo(map);

    map.on("load", () => {
      map.addSource("radius", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#4ade80", "fill-opacity": 0.15 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#16a34a", "line-width": 2 } });
      loadedRef.current = true;
      if (start) {
        (map.getSource("radius") as GeoJSONSource).setData(circlePolygon(start, initial.current.radiusKm));
      }
    });
    map.on("click", (e) => onChangeRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }));

    return () => {
      loadedRef.current = false;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;
    marker.setLngLat([value.lng, value.lat]);
    if (!marker.getElement().isConnected) marker.addTo(map);
    if (loadedRef.current) {
      (map.getSource("radius") as GeoJSONSource | undefined)?.setData(circlePolygon(value, radiusKm));
    }
  }, [value, radiusKm]);

  return <div ref={containerRef} className="h-full w-full" data-testid="location-map" />;
}
