import Link from "next/link";
import type { Listing } from "@/lib/ivy/types";
import { formatInrCompact, formatSqft, formatLocality, formatBedroom, titleCase } from "@/lib/ivy/format";
import { SaveButton } from "./SaveButton";

export function ListingCard({ listing, saved }: { listing: Listing; saved: boolean }) {
  const pricePerSqft = Math.round(listing.price / listing.carpet_area);

  return (
    <Link
      href={`/listings/${encodeURIComponent(listing.listing_id)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/60">
        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
          {titleCase(listing.property_type)}
        </span>
        <div className="absolute right-2 top-2">
          <SaveButton listingId={listing.listing_id} initialSaved={saved} />
        </div>
        {!listing.is_live && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
            Inactive
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold text-slate-900 dark:text-slate-50">
            {listing.apartment_name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatLocality(listing.locality)}</p>
        </div>

        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {formatInrCompact(listing.price)}
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            ({pricePerSqft.toLocaleString("en-IN")}/sqft)
          </span>
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
          <span>{formatBedroom(listing.bedroom)}</span>
          <span>{listing.bathroom} Bath</span>
          <span>{formatSqft(listing.carpet_area)}</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {titleCase(listing.furnishing)}
          </span>
          {listing.is_verified && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Verified</span>
          )}
        </div>
      </div>
    </Link>
  );
}
