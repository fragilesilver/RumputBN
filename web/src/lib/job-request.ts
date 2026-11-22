/**
 * Validation for "request a cutter" submissions. The client sends only what
 * the customer drew and chose; the server recomputes area and price from it.
 */
import { billableAreaM2, isInBrunei, jobLocation, type DrawnShape } from "./geo";
import { calculateQuote, type Extras, type GrassCondition, type Quote } from "./pricing";

export type JobRequestInput = {
  shapes: DrawnShape[];
  condition: GrassCondition;
  extras: Extras;
  /** YYYY-MM-DD, optional. */
  preferredDate: string | null;
  notes: string | null;
};

export type ValidJobRequest = JobRequestInput & {
  areaM2: number;
  quote: Quote;
  location: { lng: number; lat: number };
};

export const MAX_SHAPES = 20;
export const MAX_POINTS_PER_SHAPE = 500;
export const MAX_NOTES = 500;
export const MAX_DAYS_AHEAD = 60;

const CONDITIONS: GrassCondition[] = ["normal", "long", "overgrown"];

type Result = { ok: true; value: ValidJobRequest } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseShape(raw: unknown): DrawnShape | null {
  if (!isObject(raw) || raw.type !== "Feature") return null;
  const props = raw.properties;
  const geom = raw.geometry;
  if (!isObject(props) || (props.kind !== "grass" && props.kind !== "exclude")) return null;
  if (!isObject(geom) || geom.type !== "Polygon" || !Array.isArray(geom.coordinates)) return null;
  const rings = geom.coordinates;
  if (rings.length !== 1 || !Array.isArray(rings[0])) return null;
  const ring = rings[0] as unknown[];
  if (ring.length < 4 || ring.length > MAX_POINTS_PER_SHAPE) return null;
  const coords: [number, number][] = [];
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const [lng, lat] = p;
    if (typeof lng !== "number" || typeof lat !== "number" || !isInBrunei(lng, lat)) return null;
    coords.push([lng, lat]);
  }
  const [first, last] = [coords[0], coords[coords.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  return {
    type: "Feature",
    properties: { kind: props.kind },
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

export function validateJobRequest(raw: unknown, today: Date = new Date()): Result {
  if (!isObject(raw)) return { ok: false, error: "Invalid request." };

  if (!Array.isArray(raw.shapes) || raw.shapes.length === 0 || raw.shapes.length > MAX_SHAPES) {
    return { ok: false, error: "Draw your grass area on the map first." };
  }
  const shapes: DrawnShape[] = [];
  for (const s of raw.shapes) {
    const shape = parseShape(s);
    if (!shape) return { ok: false, error: "One of the shapes is invalid or outside Brunei." };
    shapes.push(shape);
  }

  const condition = raw.condition as GrassCondition;
  if (!CONDITIONS.includes(condition)) return { ok: false, error: "Choose the grass condition." };

  const e = raw.extras;
  if (
    !isObject(e) ||
    typeof e.removeClippings !== "boolean" ||
    typeof e.edging !== "boolean" ||
    typeof e.slope !== "boolean"
  ) {
    return { ok: false, error: "Invalid extras." };
  }
  const extras: Extras = { removeClippings: e.removeClippings, edging: e.edging, slope: e.slope };

  let preferredDate: string | null = null;
  if (raw.preferredDate !== null && raw.preferredDate !== undefined && raw.preferredDate !== "") {
    if (typeof raw.preferredDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.preferredDate)) {
      return { ok: false, error: "Invalid date." };
    }
    const d = new Date(`${raw.preferredDate}T00:00:00Z`);
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const days = (d.getTime() - start) / 86_400_000;
    if (Number.isNaN(days) || days < 0 || days > MAX_DAYS_AHEAD) {
      return { ok: false, error: `Pick a date within the next ${MAX_DAYS_AHEAD} days.` };
    }
    preferredDate = raw.preferredDate;
  }

  let notes: string | null = null;
  if (raw.notes !== null && raw.notes !== undefined) {
    if (typeof raw.notes !== "string") return { ok: false, error: "Invalid notes." };
    const trimmed = raw.notes.trim();
    if (trimmed.length > MAX_NOTES) return { ok: false, error: `Notes are limited to ${MAX_NOTES} characters.` };
    notes = trimmed || null;
  }

  const areaM2 = Math.round(billableAreaM2(shapes));
  if (areaM2 <= 0) return { ok: false, error: "Draw at least one grass area." };
  const quote = calculateQuote({ areaM2, condition, extras });
  if (quote.needsSiteVisit) {
    return { ok: false, error: "This area is too large for an instant quote." };
  }
  const location = jobLocation(shapes);
  if (!location) return { ok: false, error: "Draw at least one grass area." };

  return { ok: true, value: { shapes, condition, extras, preferredDate, notes, areaM2, quote, location } };
}
