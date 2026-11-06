import type { Viewport } from "next";
import { getTeacherSession } from "@/lib/auth";
import { getTeacher, getTeacherAuth, getSchool, listTeacherAttendance, listLeaves } from "@/lib/db";
import { schoolMetrics, teacherDaySchedule } from "@/lib/metrics";
import { getFaceReference } from "@/lib/face";
import { DEFAULT_GEOFENCE_RADIUS_M } from "@/config/rules";
import { localToday, isoToHHMM, shortDate, longDate, numericDate } from "@/lib/time";
import { formatMoney } from "@/config/money";
import { formatHours } from "@/components/app/TodayStatus";
import { TeacherLogin } from "@/components/espace/TeacherLogin";
import { TeacherSetCode } from "@/components/espace/TeacherSetCode";
import { TeacherPunch, type TeacherReport } from "@/components/espace/TeacherPunch";

// Écran de pointage façon application : stable, sans zoom involontaire.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#1a3280" };

export default async function EspacePage({ searchParams }: PageProps<"/espace">) {
  const ts = await getTeacherSession();
  if (!ts) return <TeacherLogin />;

  const [t, school] = await Promise.all([getTeacherAuth(ts.schoolId, ts.teacherId), getSchool(ts.schoolId)]);
  // Enseignant archivé, supprimé ou code réinitialisé par la direction : reconnexion obligatoire.
  if (!t || t.status !== "active" || (t.userId ?? null) !== ts.authId) return <TeacherLogin expired />;
  // Première connexion : choix du code personnel avant de pouvoir pointer.
  if (!t.userId) return <TeacherSetCode firstName={t.firstName} mode="first" />;

  const sp = await searchParams;
  const today = localToday();
  const [teacher, metrics, rows, schedule, leaves, faceRef] = await Promise.all([
    getTeacher(ts.schoolId, ts.teacherId),
    schoolMetrics(ts.schoolId, [ts.teacherId], { tolerance: school?.late_tolerance_min }),
    listTeacherAttendance(ts.schoolId, ts.teacherId, 7),
    teacherDaySchedule(ts.teacherId, today),
    listLeaves(ts.schoolId, ts.teacherId),
    getFaceReference(ts.teacherId),
  ]);
  if (!teacher) return <TeacherLogin expired />;

  // Relevé de l'enseignant : exactement les mêmes calculs que ceux de la direction.
  const m = metrics.month.byTeacher[teacher.id];
  const report: TeacherReport = {
    monthLabel: metrics.month.label,
    verifiedHours: formatHours(m?.verifiedHours ?? 0),
    pay: formatMoney(m?.pay ?? 0, false),
    lateCount: m?.lateCount ?? 0,
    absences: m?.absences ?? 0,
    missingDepartures: m?.missingDepartures ?? 0,
    history: rows.map((r) => {
      let status = "Validé";
      let tone: "ok" | "warn" | "bad" = "ok";
      if (!r.within_geofence) {
        status = "Hors zone · non validé";
        tone = "bad";
      } else if (!r.check_in) {
        status = "Arrivée non pointée";
        tone = "warn";
      } else if (!r.check_out) {
        status = r.date < today ? "Départ non pointé" : "En cours";
        tone = r.date < today ? "warn" : "ok";
      } else if (r.late_minutes > 0) {
        status = `Retard · ${r.late_minutes} min`;
        tone = "warn";
      }
      return { id: r.id, day: shortDate(r.date), times: `${isoToHHMM(r.check_in)} → ${isoToHHMM(r.check_out)}`, status, tone };
    }),
  };

  return (
    <TeacherPunch
      firstName={teacher.firstName}
      subject={teacher.subject || "Enseignant"}
      schoolName={school?.name || "Votre école"}
      today={today}
      todayLabel={longDate(today)}
      report={report}
      schedule={schedule}
      leaves={leaves.slice(0, 5).map((l) => ({
        id: l.id,
        label: `${l.type} · ${l.start_date === l.end_date ? numericDate(l.start_date) : `${numericDate(l.start_date)} → ${numericDate(l.end_date)}`}`,
        status: l.status,
      }))}
      codeChanged={sp.code === "ok"}
      schoolLocated={school?.lat != null}
      faceReference={faceRef?.descriptor ?? null}
      school={
        school?.lat != null && school?.lng != null
          ? { lat: school.lat, lng: school.lng, radius: school.radius_m || DEFAULT_GEOFENCE_RADIUS_M }
          : null
      }
    />
  );
}
