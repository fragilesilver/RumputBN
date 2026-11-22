import { describe, expect, it } from "vitest";
import { billableAreaM2, isInBrunei, jobLocation, type AreaKind, type DrawnShape } from "./geo";

// Roughly 1 m in degrees near Bandar Seri Begawan (lat ≈ 4.9°).
const M_LAT = 1 / 110_574;
const M_LNG = 1 / (111_320 * Math.cos((4.9 * Math.PI) / 180));
const ORIGIN = { lng: 114.94, lat: 4.9 };

/** Axis-aligned rectangle given in metres from the origin. */
function rect(x: number, y: number, w: number, h: number, kind: AreaKind = "grass"): DrawnShape {
  const p = (dx: number, dy: number) => [ORIGIN.lng + dx * M_LNG, ORIGIN.lat + dy * M_LAT];
  return {
    type: "Feature",
    properties: { kind },
    geometry: {
      type: "Polygon",
      coordinates: [[p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h), p(x, y)]],
    },
  };
}

describe("billableAreaM2", () => {
  it("is zero with nothing drawn", () => {
    expect(billableAreaM2([])).toBe(0);
  });

  it("measures a 20 × 15 m lawn as ~300 m²", () => {
    expect(billableAreaM2([rect(0, 0, 20, 15)])).toBeCloseTo(300, -1);
  });

  it("does not double count overlapping grass shapes", () => {
    // Two 10 × 10 squares overlapping by 5 × 10 → 150 m²
    const a = rect(0, 0, 10, 10);
    const b = rect(5, 0, 10, 10);
    expect(billableAreaM2([a, b])).toBeCloseTo(150, -1);
  });

  it("subtracts excluded areas such as the house", () => {
    const lawn = rect(0, 0, 30, 20); // 600
    const house = rect(10, 5, 10, 10, "exclude"); // 100
    expect(billableAreaM2([lawn, house])).toBeCloseTo(500, -1);
  });

  it("ignores exclusions that sit outside the lawn", () => {
    const lawn = rect(0, 0, 10, 10);
    const elsewhere = rect(50, 50, 10, 10, "exclude");
    expect(billableAreaM2([lawn, elsewhere])).toBeCloseTo(100, -1);
  });

  it("ignores exclusion-only drawings", () => {
    expect(billableAreaM2([rect(0, 0, 10, 10, "exclude")])).toBe(0);
  });
});

describe("jobLocation & isInBrunei", () => {
  it("centres on the grass shapes only", () => {
    const loc = jobLocation([rect(0, 0, 20, 20), rect(500, 500, 10, 10, "exclude")]);
    expect(loc?.lng).toBeCloseTo(ORIGIN.lng + 10 * M_LNG, 6);
    expect(loc?.lat).toBeCloseTo(ORIGIN.lat + 10 * M_LAT, 6);
  });

  it("knows Brunei from Kuala Lumpur", () => {
    expect(isInBrunei(114.94, 4.89)).toBe(true);
    expect(isInBrunei(101.69, 3.14)).toBe(false);
    expect(isInBrunei(Number.NaN, 4.9)).toBe(false);
  });
});
