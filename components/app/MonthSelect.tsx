"use client";

import { usePathname, useRouter } from "next/navigation";

/** Sélecteur de mois (paie, rapports) : change le paramètre ?mois= de la page. */
export function MonthSelect({ value, months }: { value: string; months: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      value={value}
      onChange={(e) => router.push(`${pathname}?mois=${e.target.value}`)}
      aria-label="Choisir le mois"
      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus:border-brand-400"
    >
      {months.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}
