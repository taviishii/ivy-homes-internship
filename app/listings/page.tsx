import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { getListings, LISTINGS_PAGE_SIZE, type ListingFilters } from "@/lib/ivy/listings";
import { getSaved } from "@/lib/ivy/saved";
import { ListingFilterBar } from "@/components/ListingFilterBar";
import { ListingCard } from "@/components/ListingCard";
import { PaginationControls } from "@/components/PaginationControls";
import { EmptyState } from "@/components/EmptyState";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams): ListingFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const locality = one(sp.locality) || undefined;
  const bedroomRaw = one(sp.bedroom);
  const minPriceRaw = one(sp.minPrice);
  const maxPriceRaw = one(sp.maxPrice);
  return {
    locality,
    bedroom: bedroomRaw !== undefined && bedroomRaw !== "" ? Number(bedroomRaw) : undefined,
    minPrice: minPriceRaw ? Number(minPriceRaw) : undefined,
    maxPrice: maxPriceRaw ? Number(maxPriceRaw) : undefined,
    furnishing: one(sp.furnishing) || undefined,
    propertyType: one(sp.propertyType) || undefined,
  };
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getAccessToken();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const offsetRaw = Array.isArray(sp.offset) ? sp.offset[0] : sp.offset;
  const offset = offsetRaw ? Math.max(0, Number(offsetRaw)) : 0;

  let page: Awaited<ReturnType<typeof getListings>> | null = null;
  let error: string | null = null;
  try {
    page = await getListings(session.token, filters, offset);
  } catch {
    error = "Couldn't load listings right now. Please try again in a moment.";
  }

  let savedIds = new Set<string>();
  try {
    const saved = await getSaved(session.token);
    savedIds = new Set(saved.results.map((l) => l.listing_id));
  } catch {
    // Saved-state is a nice-to-have on this page; don't fail the whole page for it.
  }

  const currentParams = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]]
    )
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Listings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Browse sale listings in your city. Filters are verified to actually narrow results.
        </p>
      </div>

      <ListingFilterBar />

      {error && <EmptyState title="Something went wrong" description={error} />}

      {!error && page && page.listings.length === 0 && (
        <EmptyState
          title="No listings match these filters"
          description="Try widening your price range or clearing a filter."
        />
      )}

      {!error && page && page.listings.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.listings.map((listing) => (
              <ListingCard key={listing.listing_id} listing={listing} saved={savedIds.has(listing.listing_id)} />
            ))}
          </div>
          <PaginationControls
            basePath="/listings"
            searchParams={currentParams}
            offset={page.offset}
            limit={LISTINGS_PAGE_SIZE}
            count={page.listings.length}
            hasMore={page.hasMore}
          />
        </>
      )}
    </div>
  );
}
