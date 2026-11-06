"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/console", label: "Vue d'ensemble" },
  { href: "/console/etablissements", label: "Établissements" },
  { href: "/console/abonnements", label: "Abonnements" },
  { href: "/console/comptes", label: "Comptes" },
  { href: "/console/audience", label: "Audience" },
  { href: "/console/journal", label: "Journal" },
  { href: "/console/reglages", label: "Réglages" },
];

export function ConsoleNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
      {TABS.map((t) => {
        const active = t.href === "/console" ? path === "/console" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
