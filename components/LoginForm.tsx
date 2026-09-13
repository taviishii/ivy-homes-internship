"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const DEMO_EMAILS = ["demo1@ivy.homes", "demo2@ivy.homes", "demo3@ivy.homes"];

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setSubmitting(false);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          list="demo-emails"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="demo1@ivy.homes"
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300 dark:focus:ring-slate-300"
        />
        <datalist id="demo-emails">
          {DEMO_EMAILS.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300 dark:focus:ring-slate-300"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
