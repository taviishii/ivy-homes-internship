"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SaveButton({
  listingId,
  initialSaved,
  variant = "icon",
}: {
  listingId: string;
  initialSaved: boolean;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch(next ? "/api/saved" : `/api/saved/${encodeURIComponent(listingId)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ listingId }) : undefined,
      });
      if (!res.ok) throw new Error("save request failed");
      router.refresh();
    } catch {
      setSaved(!next); // revert on failure
    } finally {
      setPending(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
          saved
            ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        }`}
      >
        {saved ? "Saved ✓ — click to remove" : "Save listing"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      aria-pressed={saved}
      className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur transition disabled:opacity-60 ${
        saved
          ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
          : "border-slate-200 bg-white/90 text-slate-400 hover:text-rose-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-500"
      }`}
    >
      <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
        />
      </svg>
    </button>
  );
}
