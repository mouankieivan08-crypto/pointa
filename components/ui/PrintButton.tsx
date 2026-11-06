"use client";

import { Icon } from "@/components/Icon";

/** Déclenche l'impression → l'utilisateur enregistre en PDF (rendu vectoriel, net). */
export function PrintButton({ label = "Enregistrer en PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
    >
      <Icon name="chart" size={18} /> {label}
    </button>
  );
}
