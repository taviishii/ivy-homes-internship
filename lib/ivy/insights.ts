// The documented GET /v1/analytics/summary does not exist (404, confirmed
// alongside ~10 plausible alternate paths — see
// analysis/INVESTIGATION_LOG.md "Endpoints — existence / path"). Every
// number on the Insights page is instead computed here from the retrievable
// datasets, using the same verified corrections as the Part 2 investigation
// (magichomes sqm fix, project Lakh/Crore conversion, real pagination via
// offset/limit rather than the broken `page`/`total` fields).
import { ivyFetch } from "./client";
import type { IvyCollection, Listing, Rental, Project } from "./types";
import { correctListingAreas, convertProjectPriceToInr } from "./format";
import { IVY_MAX_LIMIT } from "./listings";

async function fetchAllPages<T>(
  accessToken: string,
  path: string
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let done = false;
  const CONCURRENCY = 6;

  while (!done) {
    const offsets = Array.from({ length: CONCURRENCY }, (_, i) => offset + i * IVY_MAX_LIMIT);
    const pages = await Promise.all(
      offsets.map((o) =>
        ivyFetch<IvyCollection<T>>(path, {
          accessToken,
          params: { offset: o, limit: IVY_MAX_LIMIT },
        })
      )
    );
    for (const page of pages) {
      all.push(...page.results);
      if (!page.has_more) done = true;
    }
    if (pages.every((p) => p.results.length === 0)) done = true;
    offset += CONCURRENCY * IVY_MAX_LIMIT;
  }

  return all;
}

/** Formats an absolute instant as a naive IST string ("YYYY-MM-DDTHH:mm:ss",
 * no offset) — the same shape as Listing.posted_at — so it can be compared
 * against posted_at values with plain string comparison. */
function toNaiveIstString(date: Date): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface LocalityStat {
  locality: string;
  count: number;
  medianPrice: number;
}

export interface InsightsData {
  computedAt: string;
  listings: {
    totalRetrievable: number;
    apiReportedTotal: number;
    activeCount: number;
    inactiveCount: number;
    avgPricePerSqft2bhk: number;
    recentCount: number;
    recentWindowEnd: string;
    byBedroom: { bedroom: number; count: number }[];
    byLocality: LocalityStat[];
  };
  rentals: {
    totalRetrievable: number;
    apiReportedTotal: number;
    avgMonthlyRent: number;
    byLocality: { locality: string; count: number }[];
  };
  projects: {
    totalRetrievable: number;
    apiReportedTotal: number;
    costliestProject: { projectId: string; apartmentName: string; priceMaxInr: number } | null;
    wrongListingCount: number;
  };
  dataQuality: {
    corruptListingsCount: number;
    fakeListingsCount: number;
  };
}

async function computeInsights(accessToken: string): Promise<InsightsData> {
  const [listingsFirstPage, rentalsFirstPage, projectsFirstPage] = await Promise.all([
    ivyFetch<IvyCollection<Listing>>("/v1/listings", { accessToken, params: { limit: 1 } }),
    ivyFetch<IvyCollection<Rental>>("/v1/rentals", { accessToken, params: { limit: 1 } }),
    ivyFetch<IvyCollection<Project>>("/v1/projects", { accessToken, params: { limit: 1 } }),
  ]);

  const [rawListings, rentals, projects] = await Promise.all([
    fetchAllPages<Listing>(accessToken, "/v1/listings"),
    fetchAllPages<Rental>(accessToken, "/v1/rentals"),
    fetchAllPages<Project>(accessToken, "/v1/projects"),
  ]);

  const listings = rawListings.map(correctListingAreas);

  const activeCount = listings.filter((l) => l.is_live).length;

  const corruptIds = findCorruptListingIds(listings);
  const fakeIds = findFakeListingIds(listings);
  const excluded = new Set([...corruptIds, ...fakeIds]);
  const eligible2bhk = listings.filter(
    (l) => l.is_live && l.bedroom === 2 && !excluded.has(l.listing_id)
  );
  const avgPricePerSqft2bhk =
    eligible2bhk.length === 0
      ? 0
      : eligible2bhk.reduce((sum, l) => sum + l.price / l.carpet_area, 0) / eligible2bhk.length;

  // A handful of listings (see analysis/INVESTIGATION_LOG.md "2027-dated
  // listings") have posted_at values far beyond the dataset's real activity
  // window — an unresolved anomaly, not genuine recent posts. Anchoring on
  // the raw max would make this metric report almost nothing, since the
  // "last 7 days" would land in that empty gap. Using the 99th percentile
  // instead excludes those rare outliers (6 of 3500, ~0.17%) without
  // hardcoding a specific date.
  const sortedByDate = [...listings].map((l) => l.posted_at).sort();
  const latestPostedAt = sortedByDate[Math.floor(sortedByDate.length * 0.99)] ?? sortedByDate.at(-1) ?? "";
  // listings.posted_at is naive IST (no offset) — append it explicitly so
  // this date arithmetic isn't at the mercy of the server's own timezone,
  // then convert the result back to the same naive-IST string shape so the
  // comparison below stays an apples-to-apples string comparison.
  const latestInstant = new Date(`${latestPostedAt}+05:30`);
  const windowStartInstant = new Date(latestInstant.getTime() - 7 * 24 * 60 * 60 * 1000);
  const windowStart = toNaiveIstString(windowStartInstant);
  const recentCount = listings.filter(
    (l) => l.posted_at >= windowStart && l.posted_at <= latestPostedAt
  ).length;

  const byBedroomMap = new Map<number, number>();
  for (const l of listings) byBedroomMap.set(l.bedroom, (byBedroomMap.get(l.bedroom) ?? 0) + 1);
  const byBedroom = [...byBedroomMap.entries()]
    .map(([bedroom, count]) => ({ bedroom, count }))
    .sort((a, b) => a.bedroom - b.bedroom);

  const byLocalityMap = new Map<string, Listing[]>();
  for (const l of listings) {
    if (!byLocalityMap.has(l.locality)) byLocalityMap.set(l.locality, []);
    byLocalityMap.get(l.locality)!.push(l);
  }
  const byLocality: LocalityStat[] = [...byLocalityMap.entries()]
    .map(([locality, ls]) => ({
      locality,
      count: ls.length,
      medianPrice: median(ls.map((l) => l.price)),
    }))
    .sort((a, b) => b.count - a.count);

  const rentalsByLocalityMap = new Map<string, number>();
  for (const r of rentals) rentalsByLocalityMap.set(r.locality, (rentalsByLocalityMap.get(r.locality) ?? 0) + 1);
  const rentalsByLocality = [...rentalsByLocalityMap.entries()]
    .map(([locality, count]) => ({ locality, count }))
    .sort((a, b) => b.count - a.count);
  const avgMonthlyRent =
    rentals.length === 0 ? 0 : rentals.reduce((sum, r) => sum + r.price, 0) / rentals.length;

  const projectsWithInr = projects.map((p) => ({
    ...p,
    priceMaxInr: convertProjectPriceToInr(p.price_max),
  }));
  const costliest = projectsWithInr.reduce<(typeof projectsWithInr)[number] | null>(
    (best, p) => (best === null || p.priceMaxInr > best.priceMaxInr ? p : best),
    null
  );

  const listingCountByProject = new Map<string, number>();
  for (const l of listings) {
    if (l.project_id) listingCountByProject.set(l.project_id, (listingCountByProject.get(l.project_id) ?? 0) + 1);
  }
  const wrongListingCount = projects.filter(
    (p) => (listingCountByProject.get(p.project_id) ?? 0) !== p.total_listings
  ).length;

  return {
    computedAt: new Date().toISOString(),
    listings: {
      totalRetrievable: listings.length,
      apiReportedTotal: listingsFirstPage.total,
      activeCount,
      inactiveCount: listings.length - activeCount,
      avgPricePerSqft2bhk,
      recentCount,
      recentWindowEnd: latestPostedAt,
      byBedroom,
      byLocality,
    },
    rentals: {
      totalRetrievable: rentals.length,
      apiReportedTotal: rentalsFirstPage.total,
      avgMonthlyRent,
      byLocality: rentalsByLocality,
    },
    projects: {
      totalRetrievable: projects.length,
      apiReportedTotal: projectsFirstPage.total,
      costliestProject: costliest
        ? { projectId: costliest.project_id, apartmentName: costliest.apartment_name, priceMaxInr: costliest.priceMaxInr }
        : null,
      wrongListingCount,
    },
    dataQuality: {
      corruptListingsCount: corruptIds.size,
      fakeListingsCount: fakeIds.size,
    },
  };
}

// Verified impossibility signals — see analysis/scripts/lib/corrupt-listings.js
// and INVESTIGATION_LOG.md "Corrupt listings (Q4)" for the full derivation.
const SWAPPED_LAT_LONG_IDS = new Set([
  "SQU-6002204",
  "ZER-6001341",
  "100-6001475",
  "DWE-6000627",
  "SQU-6002405",
  "MAG-6000014",
]);

function findCorruptListingIds(listings: Listing[]): Set<string> {
  const ids = new Set<string>();
  for (const l of listings) {
    if (l.price <= 0) ids.add(l.listing_id);
    if (l.floor > l.total_floors) ids.add(l.listing_id);
    if (l.carpet_area > l.super_built_up_area) ids.add(l.listing_id);
    if (SWAPPED_LAT_LONG_IDS.has(l.listing_id)) ids.add(l.listing_id);
  }
  return ids;
}

// See INVESTIGATION_LOG.md "Fake listings (Q9)" for the full derivation.
const COMPANY_NAME_PATTERN =
  /\b(homes?|estates?|realty|properties|housing|nest|realtors?|space|group|associates?|infra|ventures?|developers?)\b/i;

function findFakeListingIds(listings: Listing[]): Set<string> {
  const byContact = new Map<string, Listing[]>();
  for (const l of listings) {
    if (!byContact.has(l.posted_by_contact)) byContact.set(l.posted_by_contact, []);
    byContact.get(l.posted_by_contact)!.push(l);
  }
  const ids = new Set<string>();
  for (const records of byContact.values()) {
    const names = new Set(records.map((r) => r.posted_by_name));
    if (names.size <= 1) continue;
    const hasCompanyName = [...names].some((n) => COMPANY_NAME_PATTERN.test(n));
    if (hasCompanyName) {
      for (const r of records) ids.add(r.listing_id);
    }
  }
  return ids;
}

let cache: { data: InsightsData; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — this is an expensive full-dataset scan

/** Cached across requests/users on this server process — insights are not
 * user-specific, just computed using whichever logged-in user's session
 * happens to trigger the (re)computation. */
export async function getInsights(accessToken: string): Promise<InsightsData> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }
  const data = await computeInsights(accessToken);
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
