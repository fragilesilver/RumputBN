import area from "@turf/area";
import difference from "@turf/difference";
import { featureCollection } from "@turf/helpers";
import union from "@turf/union";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type AreaKind = "grass" | "exclude";

export type DrawnShape = Feature<Polygon, { kind: AreaKind }>;

/**
 * Billable grass area in m²: the union of every grass shape, minus the union
 * of every "exclude" shape (house, driveway, pool…). Using union/difference
 * means overlapping shapes are never double-counted.
 */
export function billableAreaM2(shapes: DrawnShape[]): number {
  const grass = shapes.filter((s) => s.properties.kind === "grass");
  const exclude = shapes.filter((s) => s.properties.kind === "exclude");
  if (grass.length === 0) return 0;

  const grassUnion = unionAll(grass);
  if (!grassUnion) return 0;
  if (exclude.length === 0) return area(grassUnion);

  const excludeUnion = unionAll(exclude);
  if (!excludeUnion) return area(grassUnion);

  const remaining = difference(featureCollection([grassUnion, excludeUnion]));
  return remaining ? area(remaining) : 0;
}

function unionAll(shapes: Feature<Polygon>[]): Feature<Polygon | MultiPolygon> | null {
  if (shapes.length === 1) return shapes[0];
  return union(featureCollection(shapes));
}

/** Generous box around Brunei (all four districts). [west, south], [east, north]. */
export const BRUNEI_BOUNDS: [[number, number], [number, number]] = [
  [113.8, 3.8],
  [115.6, 5.3],
];
/** Bandar Seri Begawan. */
export const BRUNEI_CENTER: [number, number] = [114.94, 4.89];

export function isInBrunei(lng: number, lat: number): boolean {
  const [[w, s], [e, n]] = BRUNEI_BOUNDS;
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= w && lng <= e && lat >= s && lat <= n;
}

/** Bounding box of shapes as [[west, south], [east, north]], or null if empty. */
export function shapesBounds(
  shapes: Feature<Polygon>[],
): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const shape of shapes) {
    for (const ring of shape.geometry.coordinates) {
      for (const [lng, lat] of ring) {
        w = Math.min(w, lng); e = Math.max(e, lng);
        s = Math.min(s, lat); n = Math.max(n, lat);
      }
    }
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** Centre of the grass shapes' bounding box — the job's map pin. */
export function jobLocation(shapes: DrawnShape[]): { lng: number; lat: number } | null {
  const b = shapesBounds(shapes.filter((s) => s.properties.kind === "grass"));
  return b ? { lng: (b[0][0] + b[1][0]) / 2, lat: (b[0][1] + b[1][1]) / 2 } : null;
}

/** Approximate circle polygon (for drawing a cutter's service radius). */
export function circlePolygon(
  center: { lng: number; lat: number },
  radiusKm: number,
  steps = 64,
): Feature<Polygon> {
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngR * Math.cos(t), center.lat + latR * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}
