import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo spin={false} />
      <h1 className="mt-8 text-2xl font-bold text-foreground">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Le lien est peut-être incomplet, ou la page a été déplacée.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:bg-surface-2">
          Accueil
        </Link>
        <Link href="/app" className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Tableau de bord
        </Link>
        <Link href="/espace" className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:bg-surface-2">
          Espace enseignant
        </Link>
      </div>
    </div>
  );
}
