import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { EMPLOYEE_OF_MONTH_WEIGHTS as W } from "@/config/rules";

// Critères réellement mesurés à partir des pointages.
const CRITERIA = [
  { label: "Ponctualité", hint: "arrivées à l'heure", w: W.punctuality as number },
  { label: "Présence", hint: "jours de cours assurés", w: W.presence as number },
  { label: "Régularité", hint: "départs pointés", w: W.regularity as number },
].filter((c) => c.w > 0);
const TOTAL = CRITERIA.reduce((s, c) => s + c.w, 0);

export default async function AwardsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [teachers, school] = await Promise.all([listTeachers(session.schoolId), getSchool(session.schoolId)]);
  const { month } = await schoolMetrics(session.schoolId, teachers.map((t) => t.id), { tolerance: school?.late_tolerance_min });

  const ranked = teachers
    .map((e) => {
      const m = month.byTeacher[e.id];
      const days = m ? m.presentDays + m.absences : 0;
      if (!m || !days) return { e, m, score: null as number | null };
      const presence = m.presentDays / days;
      const punctuality = m.presentDays ? (m.presentDays - m.lateCount) / m.presentDays : 0;
      const regularity = m.presentDays ? (m.presentDays - m.missingDepartures) / m.presentDays : 0;
      const score = Math.round(((punctuality * W.punctuality + presence * W.presence + regularity * W.regularity) / TOTAL) * 100);
      return { e, m, score };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const anyScore = ranked.some((r) => r.score != null);

  return (
    <div className="space-y-6">
      <PageHeader title="Enseignant du mois" subtitle={`Classement de ${month.label}, calculé à partir des pointages`} />

      {teachers.length === 0 ? (
        <EmptyState icon="trophy" title="Pas encore de classement" description="Ajoutez vos enseignants. Le classement se calculera automatiquement dès qu'ils commenceront à pointer (ponctualité, présence, régularité)." action={<ButtonLink href="/app/employees/new"><Icon name="plus" size={18} /> Ajouter un enseignant</ButtonLink>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card padded={false} className="lg:col-span-2">
            <CardHeader title="Classement" />
            {!anyScore && (
              <div className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm text-muted">
                <Icon name="clock" size={17} className="text-brand-600" /> Le classement apparaîtra dès les premiers jours de cours pointés.
              </div>
            )}
            <ul className="divide-y divide-border">
              {ranked.map(({ e, m, score }, i) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${score != null && i === 0 ? "bg-brand-600 text-white" : "bg-surface-2 text-muted"}`}>
                    {score != null ? i + 1 : "–"}
                  </span>
                  <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={34} photoUrl={e.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</p>
                    <p className="truncate text-xs text-muted">
                      {m && score != null ? `${m.presentDays} j présent · ${m.lateCount} retard(s) · ${m.absences} absence(s)` : e.subject || "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {score != null ? <>{score}<span className="font-normal text-muted">/100</span></> : <span className="font-normal text-muted">—</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-foreground">Critères</h3>
            <p className="mt-1 text-xs text-muted">Poids de chaque critère dans la note sur 100.</p>
            <ul className="mt-4 space-y-3">
              {CRITERIA.map((c) => {
                const pct = Math.round((c.w / TOTAL) * 100);
                return (
                  <li key={c.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{c.label} <span className="text-xs text-muted">· {c.hint}</span></span>
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
