import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { listActivity } from "@/lib/db";

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const log = await listActivity(session.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader title="Journal d'activité" subtitle="Toutes les actions sont tracées et horodatées" />

      {log.length === 0 ? (
        <EmptyState icon="history" title="Journal vide" description="Les actions importantes (ajout d'enseignant, modification de taux, validation de localisation, pointages…) seront tracées ici." />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {log.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted"><Icon name="history" size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground"><span className="font-semibold">{l.actor || "Système"}</span> {l.action}.</p>
                  <p className="mt-0.5 text-xs text-muted">{new Date(l.created_at).toLocaleString("fr-FR")}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
