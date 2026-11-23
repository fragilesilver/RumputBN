import { describe, expect, it } from "vitest";
import {
  calculateQuote,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_PRICING,
  formatBND,
  splitEarnings,
  tieredMowingCost,
} from "./pricing";

const noExtras = { removeClippings: false, edging: false, slope: false };

describe("tieredMowingCost", () => {
  const tiers = DEFAULT_PRICING.tiers;

  it("charges only the first tier for small lawns", () => {
    expect(tieredMowingCost(100, tiers)).toBeCloseTo(5);
  });

  it("splits area across tiers", () => {
    // 200 × 0.05 + 100 × 0.03
    expect(tieredMowingCost(300, tiers)).toBeCloseTo(13);
    // 200 × 0.05 + 800 × 0.03 + 500 × 0.02
    expect(tieredMowingCost(1500, tiers)).toBeCloseTo(44);
  });

  it("treats negative area as zero", () => {
    expect(tieredMowingCost(-50, tiers)).toBe(0);
  });
});

describe("calculateQuote", () => {
  it("matches the real calibration job: ~700 m² of grass for B$30", () => {
    const q = calculateQuote({ areaM2: 700, condition: "normal", extras: noExtras });
    expect(q.subtotal).toBeCloseTo(30); // 5 call-out + 10 + 15 mowing
    expect(q.total).toBe(30);
    expect(q.fairRange).toEqual({ min: 26, max: 35 });
  });

  it("prices a small 300 m² compound", () => {
    const q = calculateQuote({ areaM2: 300, condition: "normal", extras: noExtras });
    expect(q.subtotal).toBeCloseTo(18); // 5 call-out + 13 mowing
    expect(q.total).toBe(18);
    expect(q.fairRange).toEqual({ min: 15, max: 21 });
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
    // mowing 13; overgrown +60% = 7.8; slope 15% of (13 × 1.6) = 3.12
    expect(q.subtotal).toBeCloseTo(5 + 13 + 7.8 + 3.12);
    expect(q.total).toBe(29);
  });

  it("charges clippings removal with a minimum, and flat edging", () => {
    const small = calculateQuote({
      areaM2: 300,
      condition: "normal",
      extras: { ...noExtras, removeClippings: true, edging: true },
    });
    // clippings: max(5, 300 × 0.01 = 3) = 5; edging 5
    expect(small.subtotal).toBeCloseTo(18 + 5 + 5);

    const big = calculateQuote({
      areaM2: 1000,
      condition: "normal",
      extras: { ...noExtras, removeClippings: true },
    });
    expect(big.lines.find((l) => l.label === "Remove clippings")?.amount).toBe(10);
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

describe("splitEarnings", () => {
  it("takes the default commission from the cutter's side", () => {
    expect(DEFAULT_COMMISSION_RATE).toBe(0.1);
    expect(splitEarnings(30)).toEqual({
      jobPrice: 30,
      platformFee: 3,
      cutterPayout: 27,
      commissionRate: 0.1,
    });
  });

  it("always adds back up to the job price", () => {
    for (const price of [25, 33, 41.5, 99.99, 1234]) {
      const s = splitEarnings(price, 0.225);
      expect(s.platformFee + s.cutterPayout).toBeCloseTo(s.jobPrice, 10);
    }
  });

  it("rejects nonsensical rates", () => {
    expect(() => splitEarnings(50, 1)).toThrow(RangeError);
    expect(() => splitEarnings(50, -0.1)).toThrow(RangeError);
  });
});
