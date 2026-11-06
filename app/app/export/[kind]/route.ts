import { getSession } from "@/lib/auth";
import { listTeachers, getSchool, listAttendanceRange } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { currentMonth, isValidMonth, lastDayOfMonth, localToday, isoToHHMM, numericDate } from "@/lib/time";
import { formatPhone } from "@/lib/phone";

/**
 * Exports Excel (CSV « ; » + BOM UTF-8, ouvert directement par Excel en français).
 * /app/export/paie?mois=2026-09 · /app/export/pointages?mois=2026-09
 */
export const dynamic = "force-dynamic";

/** Cellule CSV sûre : guillemets échappés, pas d'interprétation en formule par Excel. */
function cell(v: string | number): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (values: (string | number)[]) => values.map(cell).join(";");
const hours = (h: number) => String(Math.round(h * 100) / 100).replace(".", ",");
const localPhone = (p: string) => formatPhone(p).replace(/^\+242 /, "");

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Non autorisé", { status: 401 });
  const { kind } = await params;
  if (kind !== "paie" && kind !== "pointages") return new Response("Export inconnu", { status: 404 });

  const q = new URL(req.url).searchParams.get("mois");
  const cur = currentMonth();
  const month = isValidMonth(q) && q <= cur ? q : cur;
  const [teachers, school] = await Promise.all([listTeachers(session.schoolId, { includeArchived: true }), getSchool(session.schoolId)]);
  const out: string[] = [];

  if (kind === "paie") {
    const { month: m } = await schoolMetrics(session.schoolId, teachers.map((t) => t.id), { month, tolerance: school?.late_tolerance_min });
    out.push(line(["Enseignant", "Matricule", "Téléphone", "Matière", "Heures vérifiées", "Retards", "Minutes de retard", "Absences", "Congés", "Hors zone", "Départs non pointés", "Prévu (FCFA)", "À payer (FCFA)"]));
    for (const e of teachers) {
      const r = m.byTeacher[e.id];
      if (e.status === "archived" && !(r?.presentDays ?? 0)) continue;
      out.push(line([`${e.firstName} ${e.lastName}`, e.matricule, localPhone(e.phone), e.subject, hours(r?.verifiedHours ?? 0), r?.lateCount ?? 0, r?.lateMinutes ?? 0, r?.absences ?? 0, r?.leaveDays ?? 0, r?.outsideDays ?? 0, r?.missingDepartures ?? 0, r?.plannedPay ?? 0, r?.pay ?? 0]));
    }
    out.push(line(["Total", "", "", "", hours(m.verifiedHours), m.lateCount, "", m.absences, "", "", "", m.plannedPay, m.pay]));
  } else {
    const names = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));
    const to = month === cur ? localToday() : lastDayOfMonth(month);
    const rows = await listAttendanceRange(session.schoolId, `${month}-01`, to);
    out.push(line(["Date", "Enseignant", "Arrivée", "Départ", "Retard (min)", "Présence validée", "Saisie"]));
    for (const r of rows) {
      out.push(line([numericDate(r.date), names.get(r.teacher_id) ?? "—", isoToHHMM(r.check_in), isoToHHMM(r.check_out), r.late_minutes || 0, r.within_geofence ? "oui" : "non", r.method === "manual" ? "correction direction" : "téléphone"]));
    }
  }

  const body = "﻿" + out.join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pointa-${kind}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
