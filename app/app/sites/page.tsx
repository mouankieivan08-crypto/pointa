import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { getSchool, listDepartments, listTeachers } from "@/lib/db";
import { createDepartmentAction } from "@/lib/actions";
import { DEFAULT_GEOFENCE_RADIUS_M } from "@/config/rules";

export default async function SitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [school, departments, teachers] = await Promise.all([
    getSchool(session.schoolId),
    listDepartments(session.schoolId),
    listTeachers(session.schoolId),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <PageHeader title="Sites & Départements" subtitle="Votre établissement et ses pôles" />

        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="pin" size={20} /></span>
              <div>
                <h3 className="font-bold text-foreground">{school?.name}</h3>
                <p className="text-xs text-muted">{school?.city || "Localisation à définir"}</p>
              </div>
            </div>
            <Badge tone="present" dot={false}>Actif</Badge>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Enseignants</dt><dd className="font-medium text-foreground">{teachers.length}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Rayon de pointage</dt><dd className="font-medium text-foreground">{school?.radius_m || DEFAULT_GEOFENCE_RADIUS_M} m</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Localisation GPS</dt><dd className="font-medium text-foreground">{school?.lat != null ? `${school.lat.toFixed(3)}, ${school.lng?.toFixed(3)}` : "À valider"}</dd></div>
          </dl>
          {school?.lat == null && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              <Link href="/app/location" className="font-semibold underline">Validez la localisation de l&apos;établissement</Link> pour activer la vérification de présence au pointage.
            </p>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <CardHeader title="Départements" />
        {departments.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucun département. Ajoutez-en un ci-dessous.</p>
        ) : (
          <ul className="divide-y divide-border">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-foreground">{d.name}</span>
              </li>
            ))}
          </ul>
        )}
        <form action={createDepartmentAction} className="flex gap-2 border-t border-border p-4">
          <input name="name" required placeholder="Ex : Sciences" className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700"><Icon name="plus" size={16} /> Ajouter</button>
        </form>
      </Card>
    </div>
  );
}
