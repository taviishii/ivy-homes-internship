import { ivyFetch } from "./client";
import type { IvyCollection, Listing } from "./types";
import { correctListingAreas } from "./format";

export const LISTINGS_PAGE_SIZE = 20;
/** Verified live: the documented maximum of 200 is wrong — anything over 50
 * is silently clamped to 50. */
export const IVY_MAX_LIMIT = 50;

export interface ListingFilters {
  locality?: string;
  bedroom?: number;
  minPrice?: number;
  maxPrice?: number;
  furnishing?: string;
  propertyType?: string;
}

export interface ListingsPage {
  listings: Listing[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Fetches one page of listings using offset/limit pagination (the
 * documented `page` parameter is silently ignored on the live API — see
 * analysis/INVESTIGATION_LOG.md). `project_id` is deliberately never used
 * as a filter here: it's silently ignored server-side.
 *
 * Applies every filter as a server-side query param, then re-checks the
 * returned records against the same filters before returning them — belt
 * and suspenders, so a UI filter can never silently show a mismatched
 * result even if the API's filtering behavior were to change.
 */
export async function getListings(
  accessToken: string,
  filters: ListingFilters,
  offset: number,
  limit: number = LISTINGS_PAGE_SIZE
): Promise<ListingsPage> {
  const data = await ivyFetch<IvyCollection<Listing>>("/v1/listings", {
    accessToken,
    params: {
      offset,
      limit: Math.min(limit, IVY_MAX_LIMIT),
      locality: filters.locality,
      bhk: filters.bedroom,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      furnishing: filters.furnishing,
      property_type: filters.propertyType,
    },
  });

  const verified = data.results.map(correctListingAreas).filter((listing) => matchesFilters(listing, filters));

  return {
    listings: verified,
    offset: data.offset,
    limit: data.limit,
    hasMore: data.has_more,
  };
}

function matchesFilters(listing: Listing, filters: ListingFilters): boolean {
  if (filters.locality && listing.locality !== filters.locality) return false;
  if (filters.bedroom !== undefined && listing.bedroom !== filters.bedroom) return false;
  if (filters.minPrice !== undefined && listing.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) return false;
  if (filters.furnishing && listing.furnishing !== filters.furnishing) return false;
  if (filters.propertyType && listing.property_type !== filters.propertyType) return false;
  return true;
}

/** The documented singular GET /v1/listing/{id} 404s live; the real path is
 * plural GET /v1/listings/{id}. */
export async function getListingById(
  accessToken: string,
  id: string
): Promise<Listing | null> {
  try {
    const listing = await ivyFetch<Listing>(`/v1/listings/${encodeURIComponent(id)}`, {
      accessToken,
    });
    return correctListingAreas(listing);
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: number }).status === 404
  );
}

/** Known locality values in this city (verified from the full downloaded
 * dataset during investigation). Used to populate the locality filter. */
export const KNOWN_LOCALITIES = [
  "dlf phase 3",
  "dwarka expressway",
  "golf course road",
  "mg road",
  "new gurgaon",
  "sector 49",
  "sector 56",
  "sector 65",
  "sector 82",
  "sohna road",
] as const;

export const FURNISHING_OPTIONS = [
  "unfurnished",
  "semi-furnished",
  "fully-furnished",
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  "apartment",
  "villa",
  "independent house",
  "plot",
  "builder floor",
] as const;
