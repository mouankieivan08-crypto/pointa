import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { SettingsForm } from "@/components/app/SettingsForm";
import { StructureForm } from "@/components/app/StructureForm";
import { getSession } from "@/lib/auth";
import { getSchool } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { getSchoolConfig } from "@/lib/school-config";
import { formatPhone } from "@/lib/phone";
import { numericDate } from "@/lib/time";
import { DEFAULT_GEOFENCE_RADIUS_M } from "@/config/rules";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [school, plan, config] = await Promise.all([getSchool(session.schoolId), getSchoolPlan(session.schoolId), getSchoolConfig(session.schoolId)]);

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Établissement, pointage, confidentialité et abonnement" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader title="Établissement" />
          <SettingsForm
            initial={{
              name: school?.name ?? "",
              type: school?.type ?? "",
              city: school?.city ?? "",
              phone: school?.phone ? formatPhone(school.phone) : "",
              tolerance: school?.late_tolerance_min ?? 10,
              faceStrict: config.faceStrict,
            }}
          />
        </Card>

        <Card padded={false} className="lg:col-span-2">
          <CardHeader title="Type de structure" action={<span className="text-xs text-muted">{config.structure.label}</span>} />
          <StructureForm initial={{ kind: config.kind, levels: config.levels }} />
        </Card>

        <Card padded={false}>
          <CardHeader title="Pointage" action={<ButtonLink href="/app/location" variant="ghost" size="sm">Localisation</ButtonLink>} />
          <dl className="divide-y divide-border">
            <SRow label="Méthode" value="Téléphone de l'enseignant + code personnel" />
            <SRow label="Vérification du visage" value={<Badge tone={config.faceStrict ? "present" : "late"} dot={false}>{config.faceStrict ? "Pointage refusé si le visage diffère" : "Alerte seulement"}</Badge>} />
            <SRow label="Localisation de l'établissement" value={school?.lat != null ? <Badge tone="present" dot={false}>Validée</Badge> : <Link href="/app/location" className="font-semibold text-brand-600 hover:underline">À valider</Link>} />
            <SRow label="Rayon autorisé" value={`${school?.radius_m || DEFAULT_GEOFENCE_RADIUS_M} m`} />
            <SRow label="Pointage hors de l'établissement" value={<Badge tone="absent" dot={false}>Non validé, non payé</Badge>} />
            <SRow label="Sans réseau" value="Pointage possible, envoyé à la reconnexion (72 h max)" />
            <SRow label="Rappels aux enseignants" value="30 min avant le cours · 5 min avant la fin" />
          </dl>
        </Card>

        <Card padded={false}>
          <CardHeader title="Confidentialité" />
          <dl className="divide-y divide-border">
            <SRow label="Position des enseignants" value="Vérifiée au pointage, jamais conservée" />
            <SRow label="Reconnaissance du visage" value="Calculée sur le téléphone, aucune image envoyée à un tiers" />
            <SRow label="Photo au pointage" value="Visible uniquement par la direction" />
            <SRow label="Relevé d'heures" value="Visible par la direction et l'enseignant" />
            <SRow label="Fichiers" value="Privés (liens temporaires)" />
          </dl>
        </Card>

        <Card padded={false}>
          <CardHeader title="Abonnement" action={<ButtonLink href="/app/upgrade" variant="ghost" size="sm">Gérer</ButtonLink>} />
          <dl className="divide-y divide-border">
            <SRow label="Offre" value={plan.paid ? plan.name : "Essai gratuit"} />
            <SRow label="Enseignants" value={`${plan.maxTeachers} maximum`} />
            <SRow label="Échéance" value={plan.until ? numericDate(plan.until) : "Sans échéance"} />
          </dl>
        </Card>

        <Card padded={false}>
          <CardHeader title="Compte" />
          <dl className="divide-y divide-border">
            <SRow label="Responsable" value={session.name || "—"} />
            <SRow label="Email de connexion" value={school?.email || "—"} />
            <SRow label="Mot de passe oublié" value={<Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline">Aide</Link>} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function SRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
