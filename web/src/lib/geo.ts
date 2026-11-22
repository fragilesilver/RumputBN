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
