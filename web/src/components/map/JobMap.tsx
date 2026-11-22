"use client";

import { Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { shapesBounds, type DrawnShape } from "@/lib/geo";
import { AREA_COLORS, createBaseMap } from "./base";

/** Read-only view of a job's drawn grass and cut-out areas. */
export default function JobMap({ shapes, lng, lat }: { shapes: DrawnShape[]; lng: number; lat: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = useRef({ shapes, lng, lat });

  useEffect(() => {
    if (!containerRef.current) return;
    const { shapes, lng, lat } = initial.current;
    const map = createBaseMap(containerRef.current, { center: [lng, lat], zoom: 18 });
    new Marker({ color: "#15803d" }).setLngLat([lng, lat]).addTo(map);

    map.on("load", () => {
      map.addSource("shapes", { type: "geojson", data: { type: "FeatureCollection", features: shapes } });
      for (const kind of ["grass", "exclude"] as const) {
        const filter = ["==", ["get", "kind"], kind] as ["==", ["get", string], string];
        map.addLayer({
          id: `${kind}-fill`,
          type: "fill",
          source: "shapes",
          filter,
          paint: { "fill-color": AREA_COLORS[kind].fill, "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: `${kind}-line`,
          type: "line",
          source: "shapes",
          filter,
          paint: { "line-color": AREA_COLORS[kind].line, "line-width": 2.5 },
        });
      }
      const b = shapesBounds(shapes);
      if (b) map.fitBounds(b, { padding: 40, maxZoom: 20, duration: 0 });
    });

    return () => map.remove();
  }, []);

  return <div ref={containerRef} className="h-full w-full" data-testid="job-map" />;
}
