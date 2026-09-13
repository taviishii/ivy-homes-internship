"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  KNOWN_LOCALITIES,
  FURNISHING_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from "@/lib/ivy/listings";
import { formatLocality, titleCase } from "@/lib/ivy/format";

const BEDROOM_OPTIONS = [0, 1, 2, 3, 4, 5];

export function ListingFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");

  // Builds the next URL from the last-committed search params, an optional
  // single-key override (for the select dropdowns), and — critically — the
  // CURRENT minPrice/maxPrice input state every time. Without folding those
  // in on every navigation, changing a dropdown before a price field has
  // blurred would push a URL built from the old committed params, silently
  // dropping whatever price range the user had just typed but not yet
  // committed (it only reappears once that field itself later blurs).
  function buildParams(override?: { key: string; value: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (override) {
      if (override.value) params.set(override.key, override.value);
      else params.delete(override.key);
    }
    if (minPrice) params.set("minPrice", minPrice);
    else params.delete("minPrice");
    if (maxPrice) params.set("maxPrice", maxPrice);
    else params.delete("maxPrice");
    params.delete("offset"); // any filter change restarts pagination
    return params;
  }

  function updateParam(key: string, value: string) {
    const params = buildParams({ key, value });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function applyPriceRange() {
    const params = buildParams();
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearAll() {
    setMinPrice("");
    setMaxPrice("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters = [...searchParams.keys()].some((k) => k !== "offset");

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${isPending ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Locality
          <select
            value={searchParams.get("locality") ?? ""}
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
            value={searchParams.get("bedroom") ?? ""}
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
            value={searchParams.get("furnishing") ?? ""}
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

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Property type
          <select
            value={searchParams.get("propertyType") ?? ""}
            onChange={(e) => updateParam("propertyType", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Any</option>
            {PROPERTY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Min price (₹)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            placeholder="No min"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Max price (₹)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            placeholder="No max"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-3 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
