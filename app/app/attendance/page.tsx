import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { StatusBadge, STATUS_ORDER, formatHours } from "@/components/app/TodayStatus";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool, attendancePhotos } from "@/lib/db";
import { schoolMetrics } from "@/lib/metrics";
import { faceChecks, type FaceCheck } from "@/lib/face";
import { FACE_LABEL } from "@/config/face";
import { localToday, isIsoDate, addDays, longDate, capitalize } from "@/lib/time";

export default async function AttendancePage({ searchParams }: PageProps<"/app/attendance">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const today = localToday();
  const raw = typeof sp.date === "string" ? sp.date : "";
  const day = isIsoDate(raw) && raw <= today ? raw : today;
  const isToday = day === today;

  const [teachers, school] = await Promise.all([listTeachers(session.schoolId), getSchool(session.schoolId)]);
  const metrics = await schoolMetrics(session.schoolId, teachers.map((t) => t.id), { day, tolerance: school?.late_tolerance_min });
  const byId = new Map(teachers.map((t) => [t.id, t]));
  const rows = [...metrics.today.rows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const ids = rows.map((r) => r.attendanceId).filter((v): v is string => !!v);
  const [photos, checks] = await Promise.all([attendancePhotos(ids), faceChecks(session.schoolId, ids)]);
  const t = metrics.today;
  const navBtn = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground hover:bg-surface-2";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pointages"
        subtitle={`${isToday ? "Aujourd'hui · " : ""}${capitalize(longDate(day))}`}
        action={<ButtonLink href={`/app/attendance/correct?date=${day}`} variant="secondary" size="sm"><Icon name="edit" size={16} /> Saisir / corriger</ButtonLink>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/app/attendance?date=${addDays(day, -1)}`} className={navBtn} aria-label="Jour précédent"><Icon name="chevronLeft" size={18} /></Link>
        <form action="/app/attendance" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={day} max={today} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400" aria-label="Choisir une date" />
          <button type="submit" className="h-10 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-foreground hover:bg-surface-2">Voir</button>
        </form>
        {!isToday && (
          <>
            <Link href={`/app/attendance?date=${addDays(day, 1)}`} className={navBtn} aria-label="Jour suivant"><Icon name="chevronRight" size={18} /></Link>
            <Link href="/app/attendance" className="text-sm font-medium text-brand-600 hover:underline">Aujourd&apos;hui</Link>
          </>
        )}
      </div>

      {teachers.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Aucun pointage"
          description="Ajoutez des enseignants et leur emploi du temps : ils pourront ensuite pointer depuis leur téléphone, dans l'enceinte de l'établissement."
          action={<ButtonLink href="/app/employees/new"><Icon name="plus" size={18} /> Ajouter un enseignant</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Présents" value={`${t.present}/${t.expected}`} sub={t.onLeave ? `+ ${t.onLeave} en congé` : "validés dans l'établissement"} icon="check" tone="present" />
            <StatCard label="En retard" value={t.late} icon="clock" tone="late" />
            <StatCard label="Absents" value={t.absent} icon="leaf" tone="absent" />
            <StatCard label="Hors zone" value={t.outside} sub="non validés" icon="pin" tone="absent" />
          </div>

          <Card padded={false}>
            <CardHeader title="Journal du jour" action={<span className="text-xs text-muted">{formatHours(t.hours)} effectuées</span>} />
            {rows.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
                <Icon name="calendar" size={18} className="text-brand-600" /> Aucun cours prévu ce jour-là dans l&apos;emploi du temps.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const e = byId.get(r.teacherId);
                  if (!e) return null;
                  const ph = r.attendanceId ? photos.get(r.attendanceId) : undefined;
                  const fc = r.attendanceId ? checks.get(r.attendanceId) : undefined;
                  return (
                    <li key={r.teacherId} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <Link href={`/app/employees/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={36} photoUrl={e.photoUrl} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</span>
                          <span className="block truncate text-xs text-muted">
                            {r.firstStart ? `1er cours ${r.firstStart}` : "Hors emploi du temps"} · arrivée {r.checkIn ?? "—"} · départ {r.checkOut ?? "—"}
                          </span>
                        </span>
                      </Link>
                      {ph && (
                        <span className="flex items-center gap-1">
                          {e.photoUrl && (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={e.photoUrl} alt="Photo d'inscription" title="Photo d'inscription" className="h-9 w-9 rounded-md object-cover opacity-80" />
                              <span className="text-muted">/</span>
                            </>
                          )}
                          {ph.in && <PunchPhoto url={ph.in} label="Arrivée" check={fc?.in} />}
                          {ph.out && <PunchPhoto url={ph.out} label="Départ" check={fc?.out} />}
                        </span>
                      )}
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge row={r} />
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {r.hours > 0 && formatHours(r.hours)}
                          <Link href={`/app/attendance/correct?teacher=${e.id}&date=${day}`} className="font-medium text-brand-600 hover:underline">Corriger</Link>
                        </span>
                      </div>
                      {(fc?.in || fc?.out) && (
                        <div className="flex w-full flex-wrap items-center gap-2 pl-12">
                          {fc.in && <FaceChip label="Arrivée" check={fc.in} />}
                          {fc.out && <FaceChip label="Départ" check={fc.out} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <p className="text-xs text-muted">
            À gauche, la photo d&apos;inscription ; à droite, les photos prises au pointage — visibles uniquement par la direction. Le visage est comparé sur le téléphone de
            l&apos;enseignant. La position n&apos;est jamais conservée : seul le résultat « dans l&apos;établissement / hors zone » est enregistré.
          </p>
        </>
      )}
    </div>
  );
}

/** Photo prise au pointage, encadrée selon le résultat de la comparaison des visages. */
function PunchPhoto({ url, label, check }: { url: string; label: string; check?: FaceCheck }) {
  const ring =
    check?.status === "verifie"
      ? "ring-2 ring-present"
      : check?.status === "doute" || check?.status === "different"
        ? "ring-2 ring-absent"
        : "ring-1 ring-border";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`${label} — ${check ? FACE_LABEL[check.status] : "visage non vérifié"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className={`h-9 w-9 rounded-md object-cover ${ring}`} />
    </a>
  );
}

function FaceChip({ label, check }: { label: string; check: FaceCheck }) {
  const tone =
    check.status === "verifie"
      ? "bg-present-bg text-present"
      : check.status === "doute" || check.status === "different"
        ? "bg-absent-bg text-absent"
        : "bg-surface-2 text-muted";
  return (
    <>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${tone}`}>
        <Icon name={check.status === "verifie" ? "check" : "alert"} size={11} />
        {label} : {FACE_LABEL[check.status].toLowerCase()}
      </span>
      {check.offline && (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-medium text-muted" title="Pointé sans réseau, envoyé à la reconnexion. L'heure enregistrée est celle du pointage.">
          <Icon name="clock" size={11} /> hors ligne
        </span>
      )}
    </>
  );
}
