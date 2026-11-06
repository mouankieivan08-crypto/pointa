import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatHours } from "@/components/app/TodayStatus";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { localDateLabel, currentMonth, isValidMonth, shortDate } from "@/lib/time";
import { BRAND } from "@/config/brand";

const EVENT_LABEL = { late: "Retard", absent: "Absence", outside: "Hors zone", missing: "Départ non pointé" } as const;

/** Relevé mensuel des présences (imprimable / PDF). */
export default async function AttendanceReport({ searchParams }: PageProps<"/rapports/pointages">) {
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
      <div className="no-print mx-auto mb-6 flex max-w-[880px] items-center justify-between px-4">
        <Link href={`/app/reports?mois=${month}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
          <Icon name="arrow" size={16} className="rotate-180" /> Retour aux rapports
        </Link>
        <PrintButton label="Enregistrer en PDF" />
      </div>

      <div className="print-sheet pointa-card mx-auto max-w-[880px] px-6 py-7 sm:px-10 sm:py-9 print:rounded-none">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo spin={false} />
            <p className="mt-3 text-lg font-bold text-foreground">{school?.name}</p>
            <p className="text-sm text-muted">Tolérance de retard : {school?.late_tolerance_min ?? 10} min</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Relevé des présences</p>
            <p className="mt-1 text-2xl font-extrabold capitalize text-foreground">{m.label}</p>
            <p className="mt-1 text-xs text-muted">Généré le {localDateLabel()}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 text-center text-muted">Aucun enseignant pour ce mois.</p>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-xs uppercase tracking-wide text-muted">
                    <th className="py-2.5 pr-2">Enseignant</th>
                    <th className="px-2 py-2.5 text-right">Jours présents</th>
                    <th className="px-2 py-2.5 text-right">Retards</th>
                    <th className="px-2 py-2.5 text-right">Absences</th>
                    <th className="px-2 py-2.5 text-right">Congés</th>
                    <th className="px-2 py-2.5 text-right">Hors zone</th>
                    <th className="px-2 py-2.5 text-right">Départs oubliés</th>
                    <th className="py-2.5 pl-2 text-right">Heures vérifiées</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ e, r }) => (
                    <tr key={e.id} className="border-b border-border">
                      <td className="py-2.5 pr-2 font-medium text-foreground">{e.firstName} {e.lastName}</td>
                      <td className="px-2 text-right text-foreground">{r?.presentDays ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.lateCount ?? 0}{r?.lateMinutes ? ` (${r.lateMinutes} min)` : ""}</td>
                      <td className="px-2 text-right text-muted">{r?.absences ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.leaveDays ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.outsideDays ?? 0}</td>
                      <td className="px-2 text-right text-muted">{r?.missingDepartures ?? 0}</td>
                      <td className="pl-2 text-right font-bold text-foreground">{formatHours(r?.verifiedHours ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-foreground">Détail des anomalies</h2>
            <div className="mt-3 space-y-3">
              {rows.filter(({ r }) => r?.events.length).length === 0 && <p className="text-sm text-muted">Aucune anomalie sur la période.</p>}
              {rows
                .filter(({ r }) => r?.events.length)
                .map(({ e, r }) => (
                  <div key={e.id} className="print-avoid-break rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {r!.events.map((ev, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          {shortDate(ev.date)} : {EVENT_LABEL[ev.kind]}
                          {ev.minutes ? ` ${ev.minutes} min` : ""}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-10 print-avoid-break">
              <div><div className="h-14 rounded-lg border border-dashed border-border" /><p className="mt-2 text-sm font-medium text-foreground">Le/La surveillant(e) général(e)</p></div>
              <div><div className="h-14 rounded-lg border border-dashed border-border" /><p className="mt-2 text-sm font-medium text-foreground">La Direction</p></div>
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
