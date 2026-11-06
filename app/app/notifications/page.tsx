import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/db";

const ICONS: Record<string, string> = { alerte: "alert", conge: "leaf", info: "info" };
const LINKS: Record<string, string> = { alerte: "/app/attendance", conge: "/app/leaves", info: "/app/upgrade" };
const TONES: Record<string, string> = { alerte: "bg-absent-bg text-absent", conge: "bg-late-bg text-late", info: "bg-brand-50 text-brand-600" };

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const notifs = await listNotifications(session.schoolId);
  // Marque comme lues à la visite (efface le badge de la cloche).
  await markNotificationsRead(session.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Pointages non validés, demandes d'absence et informations sur votre abonnement" />

      {notifs.length === 0 ? (
        <EmptyState icon="bell" title="Aucune notification" description="Vous serez prévenu ici quand un pointage est fait hors de l'établissement ou quand un enseignant demande une absence." />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {notifs.map((n) => (
              <li key={n.id}>
                <Link href={LINKS[n.type] ?? "/app"} className={`flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2/60 ${n.read ? "" : "bg-brand-50/40"}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[n.type] ?? "bg-brand-50 text-brand-600"}`}>
                    <Icon name={ICONS[n.type] ?? "bell"} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Brazzaville", dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
