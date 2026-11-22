import { describe, expect, it } from "vitest";
import { calculateQuote, DEFAULT_PRICING, formatBND, tieredMowingCost } from "./pricing";

const noExtras = { removeClippings: false, edging: false, slope: false };

describe("tieredMowingCost", () => {
  const tiers = DEFAULT_PRICING.tiers;

  it("charges only the first tier for small lawns", () => {
    expect(tieredMowingCost(100, tiers)).toBeCloseTo(10);
  });

  it("splits area across tiers", () => {
    // 200 × 0.10 + 100 × 0.07
    expect(tieredMowingCost(300, tiers)).toBeCloseTo(27);
    // 200 × 0.10 + 800 × 0.07 + 500 × 0.05
    expect(tieredMowingCost(1500, tiers)).toBeCloseTo(101);
  });

  it("treats negative area as zero", () => {
    expect(tieredMowingCost(-50, tiers)).toBe(0);
  });
});

describe("calculateQuote", () => {
  it("prices a typical 300 m² house compound", () => {
    const q = calculateQuote({ areaM2: 300, condition: "normal", extras: noExtras });
    expect(q.subtotal).toBeCloseTo(37); // 10 call-out + 27 mowing
    expect(q.total).toBe(37);
    expect(q.fairRange).toEqual({ min: 31, max: 43 });
    expect(q.minimumApplied).toBe(false);
  });

  it("applies the minimum job price to tiny lawns", () => {
    const q = calculateQuote({ areaM2: 20, condition: "normal", extras: noExtras });
    expect(q.minimumApplied).toBe(true);
    expect(q.total).toBe(DEFAULT_PRICING.minimumJob);
  });

  it("adds condition and slope surcharges on the mowing portion only", () => {
    const q = calculateQuote({
      areaM2: 300,
      condition: "overgrown",
      extras: { ...noExtras, slope: true },
    });
    // mowing 27; overgrown +60% = 16.2; slope 15% of (27 × 1.6) = 6.48
    expect(q.subtotal).toBeCloseTo(10 + 27 + 16.2 + 6.48);
    expect(q.total).toBe(60);
  });

  it("charges clippings removal with a minimum, and flat edging", () => {
    const small = calculateQuote({
      areaM2: 300,
      condition: "normal",
      extras: { ...noExtras, removeClippings: true, edging: true },
    });
    // clippings: max(8, 300 × 0.02 = 6) = 8; edging 8
    expect(small.subtotal).toBeCloseTo(37 + 8 + 8);

    const big = calculateQuote({
      areaM2: 1000,
      condition: "normal",
      extras: { ...noExtras, removeClippings: true },
    });
    expect(big.lines.find((l) => l.label === "Remove clippings")?.amount).toBe(20);
  });

  it("flags very large areas for a site visit", () => {
    const q = calculateQuote({ areaM2: 25000, condition: "normal", extras: noExtras });
    expect(q.needsSiteVisit).toBe(true);
  });
});

describe("formatBND", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatBND(37)).toBe("B$37");
    expect(formatBND(6.5)).toBe("B$6.50");
    expect(formatBND(1200)).toBe("B$1,200");
  });
});
