import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatHours } from "@/components/app/TodayStatus";
import { MonthSelect } from "@/components/app/MonthSelect";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { currentMonth, isValidMonth, recentMonths, monthLabelOf, capitalize } from "@/lib/time";
import { formatMoney } from "@/config/money";

export default async function PayrollPage({ searchParams }: PageProps<"/app/payroll">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const cur = currentMonth();
  const month = typeof sp.mois === "string" && isValidMonth(sp.mois) && sp.mois <= cur ? sp.mois : cur;

  const [all, school] = await Promise.all([listTeachers(session.schoolId, { includeArchived: true }), getSchool(session.schoolId)]);
  const metrics = await schoolMetrics(session.schoolId, all.map((t) => t.id), { month, tolerance: school?.late_tolerance_min });
  const m = metrics.month;
  // Un enseignant archivé reste dans la paie du mois où il a travaillé.
  const teachers = all.filter((e) => e.status !== "archived" || (m.byTeacher[e.id]?.presentDays ?? 0) > 0);
  const months = recentMonths(12).map((v) => ({ value: v, label: capitalize(monthLabelOf(v)) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie horaire"
        subtitle={`Calculée sur les heures réellement pointées · ${m.label}${metrics.isCurrentMonth ? " (mois en cours : montant provisoire)" : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <MonthSelect value={month} months={months} />
            <ButtonLink href={`/rapports/paie?mois=${month}`} variant="secondary" size="md"><Icon name="printer" size={18} /> PDF</ButtonLink>
            <a href={`/app/export/paie?mois=${month}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-[0.95rem] font-semibold text-brand-700 hover:bg-surface-2"><Icon name="download" size={18} /> Excel</a>
          </div>
        }
      />

      {teachers.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Aucune paie à afficher"
          description="Ajoutez vos intervenants et leur emploi du temps. Dès qu'ils pointeront, la paie se calculera automatiquement (heures vérifiées × taux)."
          action={<ButtonLink href="/app/employees/new"><Icon name="plus" size={18} /> Ajouter</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="À payer" value={formatMoney(m.pay, false)} sub="FCFA · heures vérifiées" icon="wallet" tone="brand" />
            <StatCard label="Heures vérifiées" value={formatHours(m.verifiedHours)} sub={m.label} icon="clock" tone="present" />
            <StatCard label="Prévu (emploi du temps)" value={formatMoney(m.plannedPay, false)} sub={metrics.isCurrentMonth ? "FCFA · à ce jour" : "FCFA · sur le mois"} icon="calendar" tone="brand" />
            <StatCard label="Retards · absences" value={`${m.lateCount} · ${m.absences}`} sub={m.label} icon="bell" tone="late" />
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
            <span>
              Montant = heures vérifiées (arrivée et départ pointés dans l&apos;établissement, sur les créneaux de l&apos;emploi du temps, remplacements et séances supplémentaires compris) × taux horaire de chaque créneau.
              Un retard réduit les heures comptées ; une absence n&apos;est pas payée. Aucune paie n&apos;est versée sans validation d&apos;un responsable.
            </span>
          </div>

          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Détail par enseignant" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Personne</th>
                    <th className="px-4 py-2.5 text-right">Heures vérifiées</th>
                    <th className="px-4 py-2.5 text-right">Retards</th>
                    <th className="px-4 py-2.5 text-right">Absences</th>
                    <th className="px-4 py-2.5 text-right">Congés</th>
                    <th className="px-4 py-2.5 text-right">Prévu</th>
                    <th className="px-4 py-2.5 text-right">À payer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {teachers.map((e) => {
                    const r = m.byTeacher[e.id];
                    return (
                      <tr key={e.id} className="hover:bg-surface-2/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={32} photoUrl={e.photoUrl} />
                            <div>
                              <p className="font-medium text-foreground">
                                {e.firstName} {e.lastName} {e.status === "archived" && <Badge tone="off" dot={false}>Archivé</Badge>}
                              </p>
                              <p className="text-xs text-muted">
                                {e.subject || "—"}
                                {r?.missingDepartures ? <span className="text-late"> · {r.missingDepartures} départ(s) non pointé(s)</span> : null}
                                {r?.outsideDays ? <span className="text-absent"> · {r.outsideDays} hors zone</span> : null}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{formatHours(r?.verifiedHours ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-muted">{r?.lateCount ?? 0}{r?.lateMinutes ? ` · ${r.lateMinutes} min` : ""}</td>
                        <td className="px-4 py-3 text-right text-muted">{r?.absences ?? 0}</td>
                        <td className="px-4 py-3 text-right text-muted">{r?.leaveDays ?? 0}</td>
                        <td className="px-4 py-3 text-right text-muted">{formatMoney(r?.plannedPay ?? 0, false)}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{formatMoney(r?.pay ?? 0, false)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-2/60">
                    <td className="px-4 py-3 font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{formatHours(m.verifiedHours)}</td>
                    <td className="px-4 py-3 text-right text-muted">{m.lateCount}</td>
                    <td className="px-4 py-3 text-right text-muted">{m.absences}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-muted">{formatMoney(m.plannedPay, false)}</td>
                    <td className="px-4 py-3 text-right text-lg font-extrabold text-brand-700">{formatMoney(m.pay, false)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
