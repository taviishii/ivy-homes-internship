import Link from "next/link";

/**
 * Offset-based pagination controls. The documented `page` parameter is
 * silently ignored by the live API — the real mechanism is `offset`/`limit`
 * — so pagination state here is an `offset` search param, not a page number.
 */
export function PaginationControls({
  basePath,
  searchParams,
  offset,
  limit,
  count,
  hasMore,
}: {
  basePath: string;
  searchParams: URLSearchParams;
  offset: number;
  limit: number;
  count: number;
  hasMore: boolean;
}) {
  function hrefFor(newOffset: number) {
    const params = new URLSearchParams(searchParams);
    if (newOffset > 0) params.set("offset", String(newOffset));
    else params.delete("offset");
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const start = count === 0 ? 0 : offset + 1;
  const end = offset + count;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {count === 0 ? "No results" : `Showing ${start}–${end}`}
      </p>
      <div className="flex gap-2">
        <Link
          href={hrefFor(Math.max(0, offset - limit))}
          aria-disabled={offset === 0}
          className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${
            offset === 0
              ? "pointer-events-none border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-700"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(offset + limit)}
          aria-disabled={!hasMore}
          className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${
            !hasMore
              ? "pointer-events-none border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-700"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
