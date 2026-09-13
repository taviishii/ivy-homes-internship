// Types reflect the LIVE API's actual response shapes, verified during the
// investigation (see analysis/INVESTIGATION_LOG.md) — not the documented
// shapes in API_REFERENCE.md, which are wrong in several places noted below.

/**
 * Actual collection response shape. The documented shape
 * ({total, page, page_size, results}) does not match reality.
 *
 * `total` is known to be unreliable — it undercounts the real number of
 * retrievable records by roughly 9.5% on every collection endpoint. Use
 * `has_more` to know whether more pages exist, never `total` for that.
 */
export interface IvyCollection<T> {
  limit: number;
  offset: number;
  count: number;
  total: number;
  has_more: boolean;
  results: T[];
}

export type PropertyType =
  | "apartment"
  | "villa"
  | "independent house"
  | "plot"
  | "builder floor";

export type Furnishing = "unfurnished" | "semi-furnished" | "fully-furnished";

/**
 * A sale listing. `posted_at` has no timezone suffix and is naive IST (not
 * UTC as documented — confirmed by cross-referencing rentals' UTC
 * timestamps against a shared generation cutoff). `is_live` is present but
 * undocumented; the endpoint returns both live and non-live records despite
 * the docs claiming only active listings are returned.
 */
export interface Listing {
  listing_id: string;
  listing_url: string;
  website: string;
  city_id: number;
  apartment_name: string;
  locality: string;
  property_type: PropertyType;
  bedroom: number;
  bathroom: number;
  balcony: number;
  floor: number;
  total_floors: number;
  furnishing: Furnishing;
  facing_direction: string;
  covered_parking: number;
  price: number;
  carpet_area: number;
  super_built_up_area: number;
  latitude: number;
  longitude: number;
  posted_by: string;
  posted_by_name: string;
  posted_by_contact: string;
  project_id: string | null;
  is_verified: boolean;
  description: string;
  posted_at: string;
  is_live: boolean;
}

/** A rental listing. Field name differs from Listing: `super_builtup_area`
 * (no underscores between "built" and "up"), and `posted_at` correctly
 * carries a UTC `Z` suffix, unlike Listing.posted_at. */
export interface Rental {
  listing_id: string;
  listing_url: string;
  website: string;
  city_id: number;
  title: string;
  apartment_name: string;
  locality: string;
  property_type: PropertyType;
  bedroom: number;
  bathroom: number;
  floor: number;
  total_floors: number;
  furnishing: Furnishing;
  facing_direction: string;
  price: number;
  deposit: number;
  maintenance: number;
  carpet_area: number;
  super_builtup_area: number;
  latitude: number;
  longitude: number;
  posted_by: string;
  posted_by_name: string;
  posted_by_contact: string;
  description: string;
  posted_at: string;
  is_live: boolean;
}

/**
 * A builder project. `price_min`/`price_max` are NOT raw rupees despite the
 * docs saying so — they follow the Indian Lakh/Crore display convention.
 * Use `convertProjectPriceToInr` (lib/ivy/format.ts) rather than the raw
 * field. `total_listings` disagrees with an independent listings join for
 * ~74% of projects — treat it as approximate, not authoritative.
 */
export interface Project {
  project_id: string;
  project_url: string;
  city_id: number;
  apartment_name: string;
  developer_name: string;
  locality: string;
  project_status: string;
  total_units: number;
  total_towers: number;
  total_floors: number;
  launch_date: string;
  possession_date: string;
  rera_number: string;
  min_area_sqft: number;
  max_area_sqft: number;
  total_listings: number;
  price_min: number;
  price_max: number;
  amenities: string[];
  latitude: number;
  longitude: number;
}

export interface SavedResponse {
  count: number;
  results: Listing[];
}
