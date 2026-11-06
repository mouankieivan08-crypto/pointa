import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatHours } from "@/components/app/TodayStatus";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { localDateLabel, currentMonth, isValidMonth } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { formatMoney } from "@/config/money";
import { BRAND } from "@/config/brand";

export default async function PayrollReport({ searchParams }: PageProps<"/rapports/paie">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const cur = currentMonth();
  const month = typeof sp.mois === "string" && isValidMonth(sp.mois) && sp.mois <= cur ? sp.mois : cur;

  const [all, school] = await Promise.all([listTeachers(session.schoolId, { includeArchived: true }), getSchool(session.schoolId)]);
  const metrics = await schoolMetrics(session.schoolId, all.map((t) => t.id), { month, tolerance: school?.late_tolerance_min });
  const m = metrics.month;
  const rows = all.filter((e) => e.status !== "archived" || (m.byTeacher[e.id]?.presentDays ?? 0) > 0).map((e) => ({ e, r: m.byTeacher[e.id] }));

  return (
    <div className="min-h-screen bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 flex max-w-[820px] items-center justify-between px-4">
        <Link href={`/app/payroll?mois=${month}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
          <Icon name="arrow" size={16} className="rotate-180" /> Retour à la paie
        </Link>
        <PrintButton label="Enregistrer en PDF" />
      </div>

      <div className="print-sheet pointa-card mx-auto max-w-[820px] px-6 py-7 sm:px-10 sm:py-9 print:rounded-none">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo spin={false} />
            <p className="mt-3 text-lg font-bold text-foreground">{school?.name}</p>
            <p className="text-sm text-muted">{[school?.city, school?.phone ? formatPhone(school.phone) : null, school?.email].filter(Boolean).join(" · ") || BRAND.email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">État de paie</p>
            <p className="mt-1 text-2xl font-extrabold capitalize text-foreground">{m.label}</p>
            <p className="mt-1 text-xs text-muted">
              Généré le {localDateLabel()}{metrics.isCurrentMonth ? " · mois en cours, montants provisoires" : ""}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 text-center text-muted">Aucun enseignant pour ce mois.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="À payer" value={formatMoney(m.pay, false)} sub="FCFA" tone="brand" />
              <Kpi label="Heures vérifiées" value={formatHours(m.verifiedHours)} sub="sur le mois" tone="present" />
              <Kpi label="Retards" value={String(m.lateCount)} sub="sur le mois" tone="brand" />
              <Kpi label="Absences" value={String(m.absences)} sub="non justifiées" tone="present" />
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-xs uppercase tracking-wide text-muted">
                    <th className="py-2.5 pr-2">Enseignant</th>
                    <th className="px-2 py-2.5">Matière</th>
                    <th className="px-2 py-2.5 text-right">Heures</th>
                    <th className="px-2 py-2.5 text-right">Retards</th>
                    <th className="px-2 py-2.5 text-right">Absences</th>
                    <th className="px-2 py-2.5 text-right">Congés</th>
                    <th className="py-2.5 pl-2 text-right">À payer</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ e, r }) => (
                    <tr key={e.id} className="border-b border-border">
                      <td className="py-2.5 pr-2 font-medium text-foreground">{e.firstName} {e.lastName}</td>
                      <td className="px-2 text-muted">{e.subject || "—"}</td>
                      <td className="px-2 text-right text-foreground">{formatHours(r?.verifiedHours ?? 0)}</td>
                      <td className="px-2 text-right text-muted">{r?.lateCount ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.absences ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.leaveDays ?? 0}</td>
                      <td className="pl-2 text-right font-bold text-foreground">{formatMoney(r?.pay ?? 0, false)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/80">
                    <td className="py-3 pr-2 font-bold text-foreground" colSpan={2}>Total</td>
                    <td className="px-2 text-right font-bold text-foreground">{formatHours(m.verifiedHours)}</td>
                    <td className="px-2 text-right text-muted">{m.lateCount}</td>
                    <td className="px-2 text-right text-muted">{m.absences}</td>
                    <td className="px-2" />
                    <td className="pl-2 text-right text-lg font-extrabold text-brand-700">{formatMoney(m.pay, false)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted">
              Montants en FCFA = heures vérifiées (arrivée et départ pointés dans l&apos;établissement, sur les créneaux de l&apos;emploi du temps, remplacements et séances supplémentaires compris) × taux horaire du créneau.
              Aucune paie n&apos;est versée sans validation d&apos;un responsable.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-10 print-avoid-break">
              <Signature label="Le/La comptable" />
              <Signature label="La Direction" />
            </div>
          </>
        )}

        <div className="mt-8 border-t border-border pt-3 text-center text-xs text-muted">
          Document généré par <span className="font-semibold text-brand-600">Pointa</span> — {BRAND.tagline}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "brand" | "present" }) {
  const fg = tone === "brand" ? "var(--brand-600)" : `var(--${tone})`;
  return (
    <div className="rounded-xl border border-border p-3 print-avoid-break">
      <p className="text-[0.7rem] text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold" style={{ color: fg }}>{value}</p>
      <p className="text-[0.7rem] text-muted">{sub}</p>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-14 rounded-lg border border-dashed border-border" />
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}
