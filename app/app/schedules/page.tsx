import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { WeekGrid } from "@/components/app/WeekGrid";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool, listOneOffSessions } from "@/lib/db";
import { getSchoolConfig } from "@/lib/school-config";
import { WEEKDAYS, localToday, addDays, shortDate, hhmmToMin } from "@/lib/time";

interface Row {
  teacherId: string;
  name: string;
  color: string;
  classe: string;
  start: string;
  end: string;
}

export default async function SchedulesPage({ searchParams }: PageProps<"/app/schedules">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const filter = typeof sp.classe === "string" ? sp.classe : "";
  const today = localToday();
  const [teachers, school, config] = await Promise.all([listTeachers(session.schoolId), getSchool(session.schoolId), getSchoolConfig(session.schoolId)]);
  const v = config.structure;
  const sessions = await listOneOffSessions(teachers.map((t) => t.id), today, addDays(today, 14));
  const names = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

  const all: (Row & { day: string })[] = teachers.flatMap((t) =>
    t.assignments
      .filter((a) => a.day && a.startTime && a.endTime)
      .map((a) => ({ day: a.day!, teacherId: t.id, name: `${t.firstName} ${t.lastName}`, color: t.color, classe: a.classe, start: a.startTime!, end: a.endTime! })),
  );
  const classes = [...new Set(all.map((r) => r.classe))].sort();
  const rows = filter ? all.filter((r) => r.classe === filter) : all;

  // Conflits : une même classe avec deux cours qui se chevauchent.
  const conflicts = new Set<string>();
  for (const a of all) {
    for (const b of all) {
      if (a === b || a.day !== b.day || a.classe !== b.classe) continue;
      if (hhmmToMin(a.start)! < hhmmToMin(b.end)! && hhmmToMin(b.start)! < hhmmToMin(a.end)!) conflicts.add(`${a.day}|${a.classe}|${a.start}|${a.teacherId}`);
    }
  }
  const weekly = Math.round(teachers.reduce((s, t) => s + t.weeklyQuotaHours, 0) * 10) / 10;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emplois du temps"
        subtitle={`${all.length} créneaux · ${classes.length} ${v.groupMany.toLowerCase()} · ${weekly} h de cours par semaine · tolérance de retard ${school?.late_tolerance_min ?? 10} min`}
        action={<ButtonLink href="/app/settings" variant="secondary" size="sm"><Icon name="settings" size={16} /> Tolérance</ButtonLink>}
      />

      {all.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Aucun emploi du temps"
          description={`Les créneaux se saisissent sur la fiche de chaque ${v.staffOne} (${v.groupOne}, jour, heure de début et de fin, taux horaire).`}
          action={<ButtonLink href={teachers.length ? "/app/employees" : "/app/employees/new"}><Icon name="plus" size={18} /> {teachers.length ? "Compléter une fiche" : `Ajouter un ${v.staffOne}`}</ButtonLink>}
        />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href="/app/schedules" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${!filter ? "bg-brand-600 text-white" : "bg-surface-2 text-foreground"}`}>Tout ({classes.length} {v.groupMany.toLowerCase()})</Link>
            {classes.map((c) => (
              <Link key={c} href={`/app/schedules?classe=${encodeURIComponent(c)}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${filter === c ? "bg-brand-600 text-white" : "bg-surface-2 text-foreground"}`}>{c}</Link>
            ))}
          </div>

          {conflicts.size > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-late-bg px-4 py-3 text-sm text-late">
              <Icon name="alert" size={18} /> Certaines {v.groupMany.toLowerCase()} ont deux cours au même moment : vérifiez les créneaux marqués « Conflit ».
            </p>
          )}

          <Card padded={false}>
            <CardHeader
              title="La semaine"
              subtitle={filter ? `${filter} uniquement` : `Toutes les ${v.groupMany.toLowerCase()}`}
              action={<span className="text-xs text-muted">{rows.length} cours</span>}
            />
            <div className="p-4 sm:p-5">
              <WeekGrid
                slots={rows.map((r) => ({ ...r, conflict: conflicts.has(`${r.day}|${r.classe}|${r.start}|${r.teacherId}`) }))}
                label="Cliquez sur un cours pour ouvrir la fiche de l'enseignant. Les cours encadrés en rouge se chevauchent."
              />
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WEEKDAYS.map((day) => {
              const list = rows.filter((r) => r.day === day).sort((a, b) => a.start.localeCompare(b.start));
              return (
                <Card key={day} padded={false}>
                  <CardHeader title={day} action={<span className="text-xs text-muted">{list.length} cours</span>} />
                  {list.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted">Pas de cours.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {list.map((r, i) => (
                        <li key={i}>
                          <Link href={`/app/employees/${r.teacherId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                            <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-foreground">{r.start} – {r.end}</span>
                            <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: r.color }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{r.classe}</span>
                              <span className="block truncate text-xs text-muted">{r.name}</span>
                            </span>
                            {conflicts.has(`${r.day}|${r.classe}|${r.start}|${r.teacherId}`) && <Badge tone="late">Conflit</Badge>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {sessions.length > 0 && (
        <Card padded={false}>
          <CardHeader title="Remplacements & séances supplémentaires (14 prochains jours)" />
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/app/employees/${s.teacherId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-surface-2/60">
                  <span className="w-24 shrink-0 font-medium text-foreground">{shortDate(s.date)}</span>
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted">{s.start} – {s.end}</span>
                  <span className="min-w-0 flex-1 text-foreground">{s.label}<span className="block text-xs text-muted">{names.get(s.teacherId)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
