/**
 * RumputBN pricing engine.
 *
 * Pure functions only (no React, no network) so the same logic can run in the
 * browser for live quotes and on the server when a booking is created.
 *
 * All money is in Brunei dollars (BND). The default rates below are starting
 * PLACEHOLDERS to be tuned against real jobs — they are not market research.
 */

export type GrassCondition = "normal" | "long" | "overgrown";

export type Extras = {
  /** Rake and take away the clippings. */
  removeClippings: boolean;
  /** Trim edges along paths, fences and walls. */
  edging: boolean;
  /** Steep or uneven ground. */
  slope: boolean;
};

export type RateTier = {
  /** Upper bound of this tier in m². `null` means "and above". */
  upToM2: number | null;
  /** Price per m² for the area that falls inside this tier. */
  perM2: number;
};

export type PricingConfig = {
  currency: "BND";
  calloutFee: number;
  tiers: RateTier[];
  conditionMultiplier: Record<GrassCondition, number>;
  removeClippings: { perM2: number; min: number };
  edgingFlat: number;
  slopeMultiplier: number;
  minimumJob: number;
  /** Cutters may counter-offer within ± this fraction of the recommended price. */
  fairBand: number;
  /** Refuse to auto-quote above this size; a site visit is needed instead. */
  maxAutoQuoteM2: number;
};

export const DEFAULT_PRICING: PricingConfig = {
  currency: "BND",
  calloutFee: 10,
  tiers: [
    { upToM2: 200, perM2: 0.1 },
    { upToM2: 1000, perM2: 0.07 },
    { upToM2: null, perM2: 0.05 },
  ],
  conditionMultiplier: { normal: 1, long: 1.25, overgrown: 1.6 },
  removeClippings: { perM2: 0.02, min: 8 },
  edgingFlat: 8,
  slopeMultiplier: 1.15,
  minimumJob: 25,
  fairBand: 0.15,
  maxAutoQuoteM2: 20000,
};

export type QuoteInput = {
  areaM2: number;
  condition: GrassCondition;
  extras: Extras;
};

export type QuoteLine = { label: string; amount: number };

export type Quote = {
  areaM2: number;
  lines: QuoteLine[];
  /** Sum of lines before the minimum-job top-up and rounding. */
  subtotal: number;
  /** Recommended price, rounded to the nearest whole dollar. */
  total: number;
  /** Range a cutter may counter-offer within. */
  fairRange: { min: number; max: number };
  minimumApplied: boolean;
  needsSiteVisit: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Price the mowing itself, walking through the tiers. */
export function tieredMowingCost(areaM2: number, tiers: RateTier[]): number {
  let remaining = Math.max(0, areaM2);
  let floor = 0;
  let cost = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const width = tier.upToM2 === null ? remaining : Math.max(0, tier.upToM2 - floor);
    const inTier = Math.min(remaining, width);
    cost += inTier * tier.perM2;
    remaining -= inTier;
    if (tier.upToM2 !== null) floor = tier.upToM2;
  }
  return cost;
}

export function calculateQuote(
  input: QuoteInput,
  config: PricingConfig = DEFAULT_PRICING,
): Quote {
  const areaM2 = Math.max(0, Math.round(input.areaM2));
  const lines: QuoteLine[] = [];

  lines.push({ label: "Call-out fee", amount: config.calloutFee });

  const mowing = tieredMowingCost(areaM2, config.tiers);
  lines.push({ label: `Mowing ${areaM2.toLocaleString("en")} m²`, amount: round2(mowing) });

  const conditionFactor = config.conditionMultiplier[input.condition];
  if (conditionFactor !== 1) {
    const label = input.condition === "long" ? "Long grass" : "Overgrown";
    lines.push({
      label: `${label} (+${Math.round((conditionFactor - 1) * 100)}%)`,
      amount: round2(mowing * (conditionFactor - 1)),
    });
  }

  if (input.extras.slope) {
    lines.push({
      label: `Slope / uneven ground (+${Math.round((config.slopeMultiplier - 1) * 100)}%)`,
      amount: round2(mowing * conditionFactor * (config.slopeMultiplier - 1)),
    });
  }

  if (input.extras.removeClippings) {
    lines.push({
      label: "Remove clippings",
      amount: round2(Math.max(config.removeClippings.min, areaM2 * config.removeClippings.perM2)),
    });
  }

  if (input.extras.edging) {
    lines.push({ label: "Edge trimming", amount: config.edgingFlat });
  }

  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const minimumApplied = subtotal < config.minimumJob;
  const total = Math.round(Math.max(subtotal, config.minimumJob));

  return {
    areaM2,
    lines,
    subtotal,
    total,
    fairRange: {
      min: Math.round(total * (1 - config.fairBand)),
      max: Math.round(total * (1 + config.fairBand)),
    },
    minimumApplied,
    needsSiteVisit: areaM2 > config.maxAutoQuoteM2,
  };
}

export function formatBND(amount: number): string {
  return `B$${amount.toLocaleString("en", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
