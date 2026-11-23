import { describe, expect, it } from "vitest";
import { validateJobRequest } from "./job-request";

const M_LAT = 1 / 110_574;
const M_LNG = 1 / (111_320 * Math.cos((4.9 * Math.PI) / 180));

function rect(w: number, h: number, kind = "grass", lng0 = 114.94, lat0 = 4.9) {
  const p = (dx: number, dy: number) => [lng0 + dx * M_LNG, lat0 + dy * M_LAT];
  return {
    type: "Feature",
    properties: { kind },
    geometry: { type: "Polygon", coordinates: [[p(0, 0), p(w, 0), p(w, h), p(0, h), p(0, 0)]] },
  };
}

const base = {
  shapes: [rect(20, 15)],
  condition: "normal",
  extras: { removeClippings: false, edging: false, slope: false },
  preferredDate: null,
  notes: "  Gate code 1234  ",
};
const today = new Date("2026-11-22T08:00:00Z");

describe("validateJobRequest", () => {
  it("recomputes area and price on the server", () => {
    const r = validateJobRequest(base, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.areaM2).toBeGreaterThan(295);
    expect(r.value.areaM2).toBeLessThan(305);
    expect(r.value.quote.total).toBe(18);
    expect(r.value.notes).toBe("Gate code 1234");
    expect(r.value.location.lng).toBeGreaterThan(114.94);
  });

  it("ignores any price the client tries to send", () => {
    const r = validateJobRequest({ ...base, quote: { total: 1 }, total: 1 }, today);
    expect(r.ok && r.value.quote.total).toBe(18);
  });

  it("rejects shapes outside Brunei", () => {
    const r = validateJobRequest({ ...base, shapes: [rect(20, 15, "grass", 101.69, 3.14)] }, today);
    expect(r).toEqual({ ok: false, error: "One of the shapes is invalid or outside Brunei." });
  });

  it("rejects malformed shapes and unknown kinds", () => {
    const open = rect(10, 10);
    open.geometry.coordinates[0].pop();
    expect(validateJobRequest({ ...base, shapes: [open] }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, shapes: [rect(10, 10, "pool")] }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, shapes: [] }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, shapes: "nope" }, today).ok).toBe(false);
  });

  it("requires some grass after cut-outs", () => {
    const r = validateJobRequest({ ...base, shapes: [rect(10, 10, "exclude")] }, today);
    expect(r.ok).toBe(false);
  });

  it("validates condition, extras, date and notes", () => {
    expect(validateJobRequest({ ...base, condition: "jungle" }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, extras: { edging: "yes" } }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, preferredDate: "2026-11-21" }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, preferredDate: "2027-03-01" }, today).ok).toBe(false);
    expect(validateJobRequest({ ...base, preferredDate: "2026-11-22" }, today).ok).toBe(true);
    expect(validateJobRequest({ ...base, notes: "x".repeat(501) }, today).ok).toBe(false);
  });

  it("refuses instant quotes for very large areas", () => {
    const r = validateJobRequest({ ...base, shapes: [rect(200, 150)] }, today);
    expect(r).toEqual({ ok: false, error: "This area is too large for an instant quote." });
  });
});
