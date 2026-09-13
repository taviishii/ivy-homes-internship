"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/listings", label: "Listings" },
  { href: "/rentals", label: "Rentals" },
  { href: "/projects", label: "Projects" },
  { href: "/saved", label: "Saved" },
  { href: "/insights", label: "Insights" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
