export default function LoadingListingDetail() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
