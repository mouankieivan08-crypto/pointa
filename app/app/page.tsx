import Link from "next/link";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/Icon";
import { StatusBadge, STATUS_ORDER, formatHours } from "@/components/app/TodayStatus";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool, listLeaves } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { getSchoolConfig } from "@/lib/school-config";
import { schoolMetrics } from "@/lib/metrics";
import { localDateLabel, capitalize, numericDate } from "@/lib/time";
import { formatMoney } from "@/config/money";

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const loc = sp.loc;

  const [teachers, school, plan, leaves, config] = await Promise.all([
    listTeachers(session.schoolId),
    getSchool(session.schoolId),
    getSchoolPlan(session.schoolId),
    listLeaves(session.schoolId),
    getSchoolConfig(session.schoolId),
  ]);
  const v = config.structure;
  const metrics = await schoolMetrics(session.schoolId, teachers.map((t) => t.id), { tolerance: school?.late_tolerance_min });
  const byId = new Map(teachers.map((t) => [t.id, t]));
  const rows = [...metrics.today.rows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const t = metrics.today;
  const m = metrics.month;
  const pending = leaves.filter((l) => l.status === "pending").length;
  const anyPunch = t.present + t.outside > 0 || Object.values(m.byTeacher).some((x) => x.presentDays > 0);
  const canAdd = teachers.length < plan.maxTeachers;

  // Mise en route guidée : visible tant que tout n'est pas fait.
  const steps = [
    { done: school?.lat != null, label: "Validez la position de l'établissement", hint: "Depuis les lieux, en un clic.", href: "/app/location" },
    { done: teachers.some((e) => e.assignments.length > 0), label: `Ajoutez vos ${v.staffMany.toLowerCase()} et leur emploi du temps`, hint: `Offert jusqu'à ${plan.maxTeachers} ${v.staffOne}s.`, href: teachers.length ? "/app/employees" : "/app/employees/new" },
    { done: teachers.some((e) => e.hasCode), label: "Envoyez à chacun son accès", hint: `Bouton WhatsApp sur chaque fiche ${v.staffOne}.`, href: "/app/employees" },
    { done: anyPunch, label: "Recevez les premiers pointages", hint: `Chaque ${v.staffOne} pointe depuis son téléphone, dans l'établissement.`, href: "/app/attendance" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bonjour{session.name ? `, ${session.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">
            {capitalize(localDateLabel())} · {school?.name}
          </p>
        </div>
        {teachers.length > 0 && canAdd && (
          <ButtonLink href="/app/employees/new" size="sm">
            <Icon name="plus" size={16} /> Ajouter un {v.staffOne}
          </ButtonLink>
        )}
      </div>

      {sp.bienvenue && (
        <Notice tone="ok" action={teachers.length === 0 ? <ButtonLink href="/app/employees/new" size="sm">Commencer</ButtonLink> : undefined}>
          Pointa est configuré pour votre {v.short.toLowerCase()}. Ajoutez vos {v.staffMany.toLowerCase()}, puis envoyez-leur leur accès : ils pourront pointer dès aujourd&apos;hui.
        </Notice>
      )}
      {loc === "ok" && <Notice tone="ok">Localisation enregistrée : les pointages sont vérifiés dans un rayon de {school?.radius_m ?? 100} m autour de l&apos;établissement.</Notice>}
      {plan.expired && plan.until && (
        <Notice tone="warn" action={<ButtonLink href="/app/upgrade" size="sm">Renouveler</ButtonLink>}>
          Votre abonnement {plan.expiredPlanName} est arrivé à échéance le {numericDate(plan.until)}. Les enseignants peuvent toujours pointer ; pour en ajouter, renouvelez-le.
        </Notice>
      )}
      {!plan.expired && !canAdd && teachers.length > 0 && (
        <Notice tone="info" action={<ButtonLink href="/app/upgrade" size="sm" variant="secondary">Voir les abonnements</ButtonLink>}>
          Vous utilisez {teachers.length}/{plan.maxTeachers} {v.staffOne}s ({plan.name}). Pour en ajouter d&apos;autres, passez à un abonnement adapté.
        </Notice>
      )}

      {doneCount < steps.length && (
        <Card padded={false}>
          <CardHeader title="Mise en route" action={<span className="text-xs font-medium text-muted">{doneCount}/{steps.length} étapes</span>} />
          <ol className="divide-y divide-border">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-present text-white" : "bg-surface-2 text-muted"}`}>
                    {s.done ? <Icon name="check" size={14} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${s.done ? "text-muted line-through" : "text-foreground"}`}>{s.label}</span>
                    <span className="block text-xs text-muted">{s.hint}</span>
                  </span>
                  {!s.done && <Icon name="chevronRight" size={18} className="text-muted" />}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {teachers.length === 0 ? (
        <EmptyState
          icon="users"
          title="Bienvenue sur Pointa"
          description={`Ajoutez votre premier ${v.staffOne} — son téléphone, sa matière, ses ${v.groupMany.toLowerCase()} et son taux horaire — pour commencer à suivre les heures et calculer la paie.`}
          action={<ButtonLink href="/app/employees/new"><Icon name="plus" size={18} /> Ajouter mon premier {v.staffOne}</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Présents" value={`${t.present}/${t.expected}`} sub={t.onLeave ? `+ ${t.onLeave} en congé` : "aujourd'hui"} icon="users" tone="present" />
            <StatCard label="En retard" value={t.late} sub="aujourd'hui" icon="clock" tone="late" />
            <StatCard label="Absents" value={t.absent} sub={t.outside ? `+ ${t.outside} hors zone` : "aujourd'hui"} icon="leaf" tone="absent" />
            <StatCard label="Heures effectuées" value={formatHours(t.hours)} sub="aujourd'hui" icon="lightning" tone="brand" />
          </div>

          <Card>
            <div className="grid gap-5 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">À payer · {m.label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                  {formatMoney(m.pay, false)} <span className="text-base font-medium text-muted">FCFA</span>
                </p>
                <Link href="/app/payroll" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                  Heures vérifiées × taux horaire <Icon name="chevronRight" size={13} />
                </Link>
              </div>
              <Mini label="Heures vérifiées" value={formatHours(m.verifiedHours)} />
              <Mini label="Retards" value={String(m.lateCount)} />
              <Mini label="Absences" value={String(m.absences)} />
            </div>
          </Card>

          {pending > 0 && (
            <Notice tone="warn" action={<ButtonLink href="/app/leaves" size="sm" variant="secondary">Répondre</ButtonLink>}>
              {pending} demande{pending > 1 ? "s" : ""} d&apos;absence en attente de votre réponse.
            </Notice>
          )}

          <Card padded={false}>
            <CardHeader title="Aujourd'hui" action={<Link href="/app/attendance" className="text-sm font-medium text-brand-600 hover:underline">Tout voir</Link>} />
            {rows.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
                <Icon name="calendar" size={18} className="text-brand-600" /> Aucun cours prévu aujourd&apos;hui dans l&apos;emploi du temps.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.slice(0, 8).map((r) => {
                  const e = byId.get(r.teacherId);
                  if (!e) return null;
                  return (
                    <li key={r.teacherId}>
                      <Link href={`/app/employees/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                        <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={38} photoUrl={e.photoUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</p>
                          <p className="truncate text-xs text-muted">
                            {e.subject || "—"}
                            {r.checkIn ? ` · arrivée ${r.checkIn}` : ""}
                            {r.checkOut ? ` · départ ${r.checkOut}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge row={r} />
                          {r.hours > 0 && <span className="text-xs text-muted">{formatHours(r.hours)}</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
