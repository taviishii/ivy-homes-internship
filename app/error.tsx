"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Something went wrong</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Try again
      </button>
    </div>
  );
}
