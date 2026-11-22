import { describe, expect, it } from "vitest";
import { billableAreaM2, type AreaKind, type DrawnShape } from "./geo";

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
