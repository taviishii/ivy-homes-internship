// Pure formatting/conversion helpers. Safe to import from Client Components
// too (no secrets, no network calls) — unlike client.ts/config.ts.
import type { Listing } from "./types";

/**
 * Converts a /v1/projects price_min or price_max raw value to actual INR.
 *
 * The documented "price_min and price_max are in rupees" is wrong. Verified
 * during investigation: these fields follow the Indian real-estate Lakh/
 * Crore display convention. Proof: sorting all 400 projects' price_min
 * values shows a hard, exact gap — every value falls in [1.00, 2.09] or
 * [41.50, 99.90], with nothing between. Converting the low range as Crores
 * (x1e7) and the high range as Lakhs (x1e5) produces one continuous,
 * gapless real-rupee range, which is only possible under this rule.
 *
 * Do not invent a different threshold — 10 sits safely in the observed gap
 * (2.09 to 41.50) for this dataset.
 */
export function convertProjectPriceToInr(raw: number): number {
  return raw < 10 ? raw * 1e7 : raw * 1e5;
}

const SQM_TO_SQFT = 10.7639;
/** magichomes listings below this raw carpet_area are in square meters, not
 * square feet — see analysis/INVESTIGATION_LOG.md "Units — magichomes area
 * fields" for the bimodal-distribution proof. */
const MAGICHOMES_SQM_THRESHOLD = 250;

/**
 * Applies the magichomes sqm->sqft correction to a full Listing. Must run
 * on every listing before it's displayed or used in any calculation — see
 * analysis/INVESTIGATION_LOG.md "Units — magichomes area fields".
 *
 * Whether to convert is decided ONCE, from carpet_area alone, then applied
 * to both carpet_area and super_built_up_area together — matching the
 * proven analysis methodology (analysis/scripts/lib/load-data.js). Checking
 * the threshold independently per field is wrong: because
 * super_built_up_area is ~1.3-1.4x carpet_area, a record near the boundary
 * can have carpet_area (sqm) just under 250 but super_built_up_area (sqm)
 * already at or above it, which — if judged independently — converts one
 * field and not the other and fabricates a false carpet > super_built_up
 * violation that doesn't exist in the source data.
 */
export function correctListingAreas(listing: Listing): Listing {
  const needsConversion = listing.website === "magichomes" && listing.carpet_area < MAGICHOMES_SQM_THRESHOLD;
  if (!needsConversion) return listing;
  return {
    ...listing,
    carpet_area: Math.round(listing.carpet_area * SQM_TO_SQFT),
    super_built_up_area: Math.round(listing.super_built_up_area * SQM_TO_SQFT),
  };
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return INR_FORMATTER.format(amount);
}

/** Compact Indian-style price, e.g. "1.45 Cr" / "68 L", for card headlines. */
export function formatInrCompact(amount: number): string {
  if (amount >= 1e7) return `${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `${(amount / 1e5).toFixed(1)} L`;
  return formatInr(amount);
}

export function formatSqft(area: number): string {
  return `${area.toLocaleString("en-IN")} sqft`;
}

export function formatLocality(locality: string): string {
  return locality.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatBedroom(bedroom: number): string {
  return bedroom === 0 ? "Studio" : `${bedroom} BHK`;
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}
