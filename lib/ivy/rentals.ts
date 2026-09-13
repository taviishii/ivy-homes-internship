import { ivyFetch } from "./client";
import type { IvyCollection, Rental } from "./types";
import { LISTINGS_PAGE_SIZE, IVY_MAX_LIMIT } from "./listings";

export interface RentalFilters {
  locality?: string;
  bedroom?: number;
  furnishing?: string;
}

export interface RentalsPage {
  rentals: Rental[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

export async function getRentals(
  accessToken: string,
  filters: RentalFilters,
  offset: number,
  limit: number = LISTINGS_PAGE_SIZE
): Promise<RentalsPage> {
  const data = await ivyFetch<IvyCollection<Rental>>("/v1/rentals", {
    accessToken,
    params: {
      offset,
      limit: Math.min(limit, IVY_MAX_LIMIT),
      locality: filters.locality,
      bhk: filters.bedroom,
      furnishing: filters.furnishing,
    },
  });

  const verified = data.results.filter((rental) => {
    if (filters.locality && rental.locality !== filters.locality) return false;
    if (filters.bedroom !== undefined && rental.bedroom !== filters.bedroom) return false;
    if (filters.furnishing && rental.furnishing !== filters.furnishing) return false;
    return true;
  });

  return { rentals: verified, offset: data.offset, limit: data.limit, hasMore: data.has_more };
}
