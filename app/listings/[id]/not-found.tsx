import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Listing not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This listing may have been withdrawn, or the link is incorrect.
      </p>
      <Link
        href="/listings"
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Back to listings
      </Link>
    </div>
  );
}
