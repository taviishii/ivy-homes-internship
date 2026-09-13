import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { LogoutButton } from "./LogoutButton";

export function Header({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/listings" className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Ivy Homes
          </Link>
          <div className="sm:hidden">
            <LogoutButton />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <NavLinks />
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm text-slate-500 dark:text-slate-400">{email}</span>
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
