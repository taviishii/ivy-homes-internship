import type { Rental } from "@/lib/ivy/types";
import { formatInr, formatSqft, formatLocality, formatBedroom, titleCase } from "@/lib/ivy/format";

export function RentalCard({ rental }: { rental: Rental }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="line-clamp-1 font-semibold text-slate-900 dark:text-slate-50">{rental.apartment_name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatLocality(rental.locality)}</p>
        </div>
        {!rental.is_live && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Inactive
          </span>
        )}
      </div>

      <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {formatInr(rental.price)}
        <span className="text-sm font-normal text-slate-400">/mo</span>
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        <span>{formatBedroom(rental.bedroom)}</span>
        <span>{rental.bathroom} Bath</span>
        <span>{formatSqft(rental.carpet_area)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {titleCase(rental.furnishing)}
        </span>
        <span>Deposit {formatInr(rental.deposit)}</span>
        {rental.maintenance > 0 && <span>Maintenance {formatInr(rental.maintenance)}/mo</span>}
      </div>
    </div>
  );
}
