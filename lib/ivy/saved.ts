import { ivyFetch, IvyApiError } from "./client";
import type { SavedResponse } from "./types";
import { correctListingAreas } from "./format";

/** The documented /v1/favourites path 404s live for every method. The real
 * endpoint is /v1/saved, and its POST body field is `listing_id`, not the
 * documented `id`. */
const SAVED_PATH = "/v1/saved";

export async function getSaved(accessToken: string): Promise<SavedResponse> {
  const data = await ivyFetch<SavedResponse>(SAVED_PATH, { accessToken });
  return { ...data, results: data.results.map(correctListingAreas) };
}

export async function saveListing(accessToken: string, listingId: string): Promise<void> {
  await ivyFetch(SAVED_PATH, {
    method: "POST",
    accessToken,
    body: { listing_id: listingId },
  });
}

/** Idempotent: treats "not in your saved list" (404) as success. */
export async function unsaveListing(accessToken: string, listingId: string): Promise<void> {
  try {
    await ivyFetch(`${SAVED_PATH}/${encodeURIComponent(listingId)}`, {
      method: "DELETE",
      accessToken,
    });
  } catch (err) {
    if (err instanceof IvyApiError && err.status === 404) return;
    throw err;
  }
}
