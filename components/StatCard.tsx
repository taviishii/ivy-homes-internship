export function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>}
    </div>
  );
}

export function BarList<T extends { count: number }>({
  items,
  labelFor,
  valueFor,
  formatValue,
}: {
  items: T[];
  labelFor: (item: T) => string;
  valueFor?: (item: T) => number;
  formatValue?: (item: T) => string;
}) {
  const max = Math.max(...items.map((i) => (valueFor ? valueFor(i) : i.count)), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const value = valueFor ? valueFor(item) : item.count;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-slate-600 dark:text-slate-400">{labelFor(item)}</span>
            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-slate-900 dark:bg-slate-300"
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
              {formatValue ? formatValue(item) : value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
