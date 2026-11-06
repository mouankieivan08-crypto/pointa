import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Icon name="search" size={26} />
      </span>
      <h1 className="mt-4 text-xl font-bold text-foreground">Élément introuvable</h1>
      <p className="mt-2 text-sm text-muted">Il a peut-être été supprimé, ou il appartient à un autre établissement.</p>
      <Link href="/app" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
