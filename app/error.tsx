"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-foreground">Un problème est survenu</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Vérifiez votre connexion internet, puis réessayez.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => retry()} className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Réessayer
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:bg-surface-2">
          Accueil
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-muted">Référence : {error.digest}</p>}
    </div>
  );
}
