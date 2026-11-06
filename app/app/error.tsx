"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";

/** Erreur dans une page de l'espace direction : le menu reste disponible, on propose de réessayer. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-late-bg text-late">
        <Icon name="bell" size={26} />
      </span>
      <h1 className="mt-4 text-xl font-bold text-foreground">Cette page n&apos;a pas pu se charger</h1>
      <p className="mt-2 text-sm text-muted">La connexion est peut-être instable. Vos données ne sont pas perdues.</p>
      <button
        onClick={() => retry()}
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Réessayer
      </button>
      {error.digest && <p className="mt-4 text-xs text-muted">Référence : {error.digest}</p>}
    </div>
  );
}
