import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAccessToken } from "@/lib/session";
import { getListingById } from "@/lib/ivy/listings";
import { getSaved } from "@/lib/ivy/saved";
import { formatInr, formatInrCompact, formatSqft, formatLocality, formatBedroom, titleCase } from "@/lib/ivy/format";
import { SaveButton } from "@/components/SaveButton";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAccessToken();
  if (!session) redirect("/login");

  const { id } = await params;

  let listing;
  try {
    listing = await getListingById(session.token, id);
  } catch {
    listing = null;
  }
  if (!listing) notFound();

  let saved = false;
  try {
    const savedList = await getSaved(session.token);
    saved = savedList.results.some((l) => l.listing_id === listing.listing_id);
  } catch {
    // Save button will still work; it just won't know the initial state.
  }

  const pricePerSqft = Math.round(listing.price / listing.carpet_area);
  // listing.posted_at is naive IST with no timezone suffix (verified during
  // investigation — see analysis/INVESTIGATION_LOG.md); append the IST
  // offset explicitly so this parses to the correct instant regardless of
  // the server's own timezone.
  const postedDate = new Date(`${listing.posted_at}+05:30`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <Link href="/listings" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        ← Back to listings
      </Link>

      <div className="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/60">
        <span className="text-base font-medium text-slate-400 dark:text-slate-500">
          {titleCase(listing.property_type)}
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {listing.apartment_name}
            </h1>
            {!listing.is_live && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Inactive
              </span>
            )}
            {listing.is_verified && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{formatLocality(listing.locality)}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{formatInr(listing.price)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatInrCompact(listing.price)} · ₹{pricePerSqft.toLocaleString("en-IN")}/sqft
          </p>
        </div>
      </div>

      <div className="w-full sm:w-64">
        <SaveButton listingId={listing.listing_id} initialSaved={saved} variant="full" />
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <Fact label="Bedrooms" value={formatBedroom(listing.bedroom)} />
        <Fact label="Bathrooms" value={String(listing.bathroom)} />
        <Fact label="Balconies" value={String(listing.balcony)} />
        <Fact label="Parking" value={String(listing.covered_parking)} />
        <Fact label="Carpet area" value={formatSqft(listing.carpet_area)} />
        <Fact label="Super built-up" value={formatSqft(listing.super_built_up_area)} />
        <Fact label="Floor" value={`${listing.floor} of ${listing.total_floors}`} />
        <Fact label="Facing" value={titleCase(listing.facing_direction)} />
        <Fact label="Furnishing" value={titleCase(listing.furnishing)} />
        <Fact label="Property type" value={titleCase(listing.property_type)} />
        <Fact label="Posted" value={postedDate} />
        <Fact label="Listed by" value={`${titleCase(listing.posted_by)} · ${listing.posted_by_name}`} />
      </dl>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Description</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{listing.description}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Contact</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {listing.posted_by_name} · {listing.posted_by_contact}
        </p>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}
