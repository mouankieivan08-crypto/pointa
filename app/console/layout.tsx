import type { Metadata } from "next";
import Link from "next/link";
import { isConsoleSession, consoleIdentity } from "@/lib/auth";
import { consoleLogoutAction } from "@/lib/console-actions";
import { ConsoleLogin } from "@/components/console/ConsoleForms";
import { ConsoleNav } from "@/components/console/ConsoleNav";

/**
 * Console plateforme (équipe Pointa) : vue sur l'ensemble des établissements clients.
 * Non référencée, protégée côté serveur, cookie limité au chemin /console.
 */
export const metadata: Metadata = { title: "Console Pointa", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  if (!(await isConsoleSession())) return <ConsoleLogin />;
  const who = await consoleIdentity();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/console" className="min-w-0">
            <p className="text-sm font-bold">Pointa <span className="text-slate-500">· Console</span></p>
            <p className="truncate text-[0.7rem] text-slate-500">Plateforme · {who}</p>
          </Link>
          <form action={consoleLogoutAction}>
            <button type="submit" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
              Verrouiller
            </button>
          </form>
        </div>
        <ConsoleNav />
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
