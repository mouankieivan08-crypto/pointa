import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { CorrectionForm } from "@/components/app/CorrectionForm";
import { getSession } from "@/lib/auth";
import { listTeachers, getAttendance, attendancePhotos, type AttendanceRow } from "@/lib/db";
import { teacherDaySchedule } from "@/lib/metrics";
import { localToday, isIsoDate, isoToHHMM, longDate, capitalize } from "@/lib/time";

export default async function CorrectAttendancePage({ searchParams }: PageProps<"/app/attendance/correct">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const today = localToday();
  const teachers = await listTeachers(session.schoolId);
  const teacherId = typeof sp.teacher === "string" ? sp.teacher : "";
  const rawDate = typeof sp.date === "string" ? sp.date : today;
  const date = isIsoDate(rawDate) && rawDate <= today ? rawDate : today;
  const teacher = teachers.find((x) => x.id === teacherId) ?? null;

  let row: AttendanceRow | null = null;
  let schedule: { classe: string; start: string; end: string; oneOff: boolean }[] = [];
  if (teacher) [row, schedule] = await Promise.all([getAttendance(session.schoolId, teacher.id, date), teacherDaySchedule(teacher.id, date)]);
  const photos = row ? (await attendancePhotos([row.id])).get(row.id) : undefined;

  const cls = "h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/attendance?date=${date}`} className="text-muted hover:text-foreground" aria-label="Retour aux pointages"><Icon name="arrow" size={20} className="rotate-180" /></Link>
        <PageHeader title="Saisir ou corriger un pointage" subtitle="Oubli, téléphone déchargé, erreur : chaque correction est tracée avec son motif." />
      </div>

      <Card>
        <form action="/app/attendance/correct" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Enseignant</span>
            <select name="teacher" defaultValue={teacher?.id ?? ""} required className={`${cls} w-full`}>
              <option value="" disabled>Choisir un enseignant…</option>
              {teachers.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Date</span>
            <input type="date" name="date" defaultValue={date} max={today} className={`${cls} w-full`} />
          </label>
          <button type="submit" className="h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">Afficher</button>
        </form>
      </Card>

      {teacher && (
        <Card padded={false}>
          <CardHeader title={`${teacher.firstName} ${teacher.lastName} · ${capitalize(longDate(date))}`} />
          <div className="space-y-2 border-b border-border px-5 py-4 text-sm">
            <p className="text-muted">
              Cours prévus :{" "}
              {schedule.length ? (
                <span className="text-foreground">{schedule.map((s) => `${s.start}–${s.end} ${s.classe}`).join(" · ")}</span>
              ) : (
                <span className="text-foreground">aucun ce jour-là (les heures ne seront pas payées sans créneau)</span>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-muted">
              Pointage actuel :{" "}
              {row ? (
                <>
                  <span className="text-foreground">arrivée {isoToHHMM(row.check_in)} · départ {isoToHHMM(row.check_out)}</span>
                  {row.within_geofence ? <Badge tone="present">Validé</Badge> : <Badge tone="absent">Non validé</Badge>}
                  {row.method === "manual" && <Badge tone="brand">Déjà corrigé</Badge>}
                </>
              ) : (
                <span className="text-foreground">aucun</span>
              )}
            </p>
            {photos && (
              <div className="flex gap-2 pt-1">
                {photos.in && <a href={photos.in} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photos.in} alt="Photo à l'arrivée" className="h-16 w-16 rounded-lg object-cover" /></a>}
                {photos.out && <a href={photos.out} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photos.out} alt="Photo au départ" className="h-16 w-16 rounded-lg object-cover" /></a>}
              </div>
            )}
          </div>
          <CorrectionForm
            key={`${teacher.id}-${date}`}
            teacherId={teacher.id}
            date={date}
            initial={{ arrival: row?.check_in ? isoToHHMM(row.check_in) : "", departure: row?.check_out ? isoToHHMM(row.check_out) : "", valid: row ? row.within_geofence : true }}
          />
        </Card>
      )}
    </div>
  );
}
