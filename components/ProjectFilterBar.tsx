"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { KNOWN_LOCALITIES } from "@/lib/ivy/listings";
import { formatLocality } from "@/lib/ivy/format";

export function ProjectFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("locality", value);
    else params.delete("locality");
    params.delete("offset");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${isPending ? "opacity-60" : ""}`}>
      <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        Locality
        <select
          defaultValue={searchParams.get("locality") ?? ""}
          onChange={(e) => updateParam(e.target.value)}
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
    </div>
  );
}
