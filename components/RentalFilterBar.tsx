"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { KNOWN_LOCALITIES, FURNISHING_OPTIONS } from "@/lib/ivy/listings";
import { formatLocality, titleCase } from "@/lib/ivy/format";

const BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5];

export function RentalFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("offset");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${isPending ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Locality
          <select
            defaultValue={searchParams.get("locality") ?? ""}
            onChange={(e) => updateParam("locality", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Any</option>
            {KNOWN_LOCALITIES.map((l) => (
              <option key={l} value={l}>
                {formatLocality(l)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Bedrooms
          <select
            defaultValue={searchParams.get("bedroom") ?? ""}
            onChange={(e) => updateParam("bedroom", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Any</option>
            {BEDROOM_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? "Studio" : `${b} BHK`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Furnishing
          <select
            defaultValue={searchParams.get("furnishing") ?? ""}
            onChange={(e) => updateParam("furnishing", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Any</option>
            {FURNISHING_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {titleCase(f)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
