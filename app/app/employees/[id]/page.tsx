import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/Icon";
import { formatHours } from "@/components/app/TodayStatus";
import { SessionForm } from "@/components/app/SessionForm";
import { getSession } from "@/lib/auth";
import { getTeacher, getSchool, listTeachers, listTeacherAttendance, attendancePhotos, listOneOffSessions, listLeaves, timetableDocUrl } from "@/lib/db";
import { getSchoolConfig } from "@/lib/school-config";
import { getFaceReference } from "@/lib/face";
import { WeekGrid } from "@/components/app/WeekGrid";
import { resetTeacherCodeAction, setTeacherStatusAction, deleteTeacherAction, deleteSessionAction } from "@/lib/actions";
import { teacherMonthlyQuota, assignmentMonthly } from "@/lib/quota";
import { schoolMetrics } from "@/lib/metrics";
import { isoToHHMM, shortDate, numericDate, localToday, addDays } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { inviteLink } from "@/lib/invite";
import { appOrigin } from "@/lib/url";
import { EMPLOYEE_STATUS_META } from "@/lib/status";
import { formatMoney } from "@/config/money";

const LEAVE_LABEL: Record<string, string> = { pending: "En attente", accepted: "Acceptée", refused: "Refusée" };
const LEAVE_TONE: Record<string, "late" | "present" | "absent"> = { pending: "late", accepted: "present", refused: "absent" };

export default async function EmployeeProfile({ params, searchParams }: PageProps<"/app/employees/[id]">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const [e, school, config] = await Promise.all([getTeacher(session.schoolId, id), getSchool(session.schoolId), getSchoolConfig(session.schoolId)]);
  if (!e) notFound();

  const today = localToday();
  const [metrics, history, sessions, leaves, docUrl, colleagues, origin] = await Promise.all([
    schoolMetrics(session.schoolId, [e.id], { tolerance: school?.late_tolerance_min }),
    listTeacherAttendance(session.schoolId, e.id, 20),
    listOneOffSessions([e.id], addDays(today, -31)),
    listLeaves(session.schoolId, e.id),
    timetableDocUrl(e.id),
    listTeachers(session.schoolId),
    appOrigin(),
  ]);
  const [photos, faceRef] = await Promise.all([attendancePhotos(history.map((r) => r.id)), getFaceReference(e.id)]);
  const hasFace = !!faceRef;
  const m = metrics.month.byTeacher[e.id];
  const meta = EMPLOYEE_STATUS_META[e.status];
  const archived = e.status === "archived";
  const invite = inviteLink({ origin, schoolName: school?.name ?? "Votre école", firstName: e.firstName, phone: e.phone, hasCode: !!e.hasCode });
  const classes = [...new Set(colleagues.flatMap((c) => c.assignments.map((a) => a.classe)))].sort();

  return (
    <div className="space-y-6">
      <Link href="/app/employees" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <Icon name="arrow" size={16} className="rotate-180" /> Retour aux enseignants
      </Link>

      {sp.nouveau && (
        <Notice tone="ok" action={<a href={invite} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-present px-3.5 text-sm font-semibold text-white"><Icon name="message" size={16} /> Envoyer son accès</a>}>
          {e.firstName} a été ajouté. Envoyez-lui maintenant son accès par WhatsApp : il pourra pointer depuis son téléphone.
        </Notice>
      )}
      {sp.modifie && <Notice tone="ok">Modifications enregistrées.</Notice>}
      {sp.code === "reinitialise" && <Notice tone="ok">Code réinitialisé : {e.firstName} se reconnecte avec son numéro de téléphone, puis choisit un nouveau code.</Notice>}
      {sp.erreur === "limite" && <Notice tone="warn">Impossible de réactiver : la limite de votre offre est atteinte. Archivez un autre enseignant ou passez à un abonnement supérieur.</Notice>}
      {sp.erreur === "confirmation" && <Notice tone="error">Pour supprimer définitivement, tapez SUPPRIMER dans le champ de confirmation.</Notice>}
      {archived && <Notice tone="info">Enseignant archivé : il ne peut plus pointer et n&apos;est plus compté dans votre offre. Son historique est conservé.</Notice>}
      {!archived && !hasFace && (
        <Notice tone="warn" action={<ButtonLink href={`/app/employees/${e.id}/edit`} size="sm" variant="secondary"><Icon name="camera" size={16} /> Ajouter la photo</ButtonLink>}>
          Aucun visage de référence : les pointages de {e.firstName} ne peuvent pas être vérifiés. Reprenez sa photo d&apos;inscription, de face et bien éclairée.
        </Notice>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={72} photoUrl={e.photoUrl} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{e.firstName} {e.lastName}</h1>
              <Badge tone={meta.tone as "present" | "late" | "off"}>{meta.label}</Badge>
            </div>
            <p className="mt-1 text-muted">{e.subject || "Enseignant"} · {e.matricule}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/app/employees/${e.id}/edit`} variant="secondary" size="sm"><Icon name="edit" size={16} /> Modifier</ButtonLink>
            {!archived && (
              <a href={invite} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-present hover:bg-present-bg">
                <Icon name="message" size={16} /> Envoyer l&apos;accès
              </a>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card padded={false}>
            <CardHeader title="Informations" />
            <dl className="divide-y divide-border">
              <Info label="Téléphone" value={formatPhone(e.phone) || "—"} />
              <Info label="Email" value={e.email || "—"} />
              <Info label="Code personnel" value={e.hasCode ? "Choisi par l'enseignant" : "Pas encore choisi"} />
              <Info
                label="Visage de référence"
                value={hasFace ? <Badge tone="present" dot={false}>Enregistré</Badge> : <Link href={`/app/employees/${e.id}/edit`} className="font-semibold text-brand-600 hover:underline">À enregistrer</Link>}
              />
              <Info label="Pointage" value="Téléphone · visage · dans l'établissement" />
              <Info label="Quota mensuel" value={e.weeklyQuotaHours ? `${teacherMonthlyQuota(e)} h` : "—"} />
            </dl>
          </Card>

          <Card padded={false}>
            <CardHeader title="Accès et statut" />
            <div className="space-y-2 p-4">
              {e.hasCode && !archived && (
                <form action={resetTeacherCodeAction}>
                  <input type="hidden" name="teacherId" value={e.id} />
                  <button type="submit" className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-2">
                    <Icon name="key" size={17} className="text-muted" />
                    <span>Réinitialiser le code <span className="block text-xs font-normal text-muted">Code oublié : il se reconnectera avec son numéro.</span></span>
                  </button>
                </form>
              )}
              <form action={setTeacherStatusAction}>
                <input type="hidden" name="teacherId" value={e.id} />
                <input type="hidden" name="status" value={archived ? "active" : "archived"} />
                <button type="submit" className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-2">
                  <Icon name={archived ? "refresh" : "archive"} size={17} className="text-muted" />
                  <span>
                    {archived ? "Réactiver l'enseignant" : "Archiver l'enseignant"}
                    <span className="block text-xs font-normal text-muted">{archived ? "Il pourra de nouveau pointer." : "Il ne travaille plus chez vous : historique conservé, place libérée."}</span>
                  </span>
                </button>
              </form>
              <details className="rounded-xl border border-absent/20">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-absent">
                  <Icon name="trash" size={17} /> Supprimer définitivement
                </summary>
                <form action={deleteTeacherAction} className="space-y-2 border-t border-absent/20 p-3">
                  <input type="hidden" name="teacherId" value={e.id} />
                  <p className="text-xs text-muted">Supprime l&apos;enseignant, ses pointages, ses photos et son historique. Irréversible — préférez l&apos;archivage.</p>
                  <input name="confirm" placeholder="Tapez SUPPRIMER" autoComplete="off" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-absent" />
                  <button type="submit" className="h-10 w-full rounded-lg bg-absent text-sm font-semibold text-white hover:opacity-90">Supprimer</button>
                </form>
              </details>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ce mois · {metrics.month.label}</p>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mini label="Heures vérifiées" value={formatHours(m?.verifiedHours ?? 0)} />
              <Mini label="Retards" value={String(m?.lateCount ?? 0)} />
              <Mini label="Absences" value={String(m?.absences ?? 0)} />
              <Mini label="À payer" value={`${formatMoney(m?.pay ?? 0, false)} FCFA`} />
            </div>
            {(!!m?.missingDepartures || !!m?.leaveDays) && (
              <p className="mt-3 text-xs text-muted">
                {m.missingDepartures ? <span className="text-late">{m.missingDepartures} départ(s) non pointé(s) : journée(s) non comptée(s). </span> : null}
                {m.leaveDays ? <span>{m.leaveDays} jour(s) de congé accepté(s).</span> : null}
              </p>
            )}
          </Card>

          <Card padded={false}>
            <CardHeader
              title="Emploi du temps & tarifs"
              action={
                <div className="flex items-center gap-3">
                  {docUrl && <a href={docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Icon name="image" size={14} /> Document importé</a>}
                  <span className="text-xs text-muted">{e.weeklyQuotaHours} h/sem.</span>
                </div>
              }
            />
            {e.assignments.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="border-b border-border p-4 sm:p-5">
                  <WeekGrid
                    slots={e.assignments
                      .filter((a) => a.day && a.startTime && a.endTime)
                      .map((a) => ({ teacherId: e.id, name: `${e.firstName} ${e.lastName}`, color: e.color, classe: a.classe, day: a.day!, start: a.startTime!, end: a.endTime! }))}
                    label={`Semaine type de ${e.firstName} : ${e.weeklyQuotaHours} h réparties sur ${new Set(e.assignments.map((a) => a.day)).size} jour(s).`}
                  />
                </div>
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-4 py-2.5">{config.structure.groupOne}</th><th className="px-4 py-2.5">Jour</th><th className="px-4 py-2.5">Créneau</th><th className="px-4 py-2.5 text-right">Durée</th><th className="px-4 py-2.5 text-right">Taux/h</th><th className="px-4 py-2.5 text-right">Potentiel/mois</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {e.assignments.map((a, i) => (
                      <tr key={a.id ?? i}>
                        <td className="px-4 py-2.5 font-medium text-foreground">{a.classe}</td>
                        <td className="px-4 py-2.5 text-muted">{a.day || "—"}</td>
                        <td className="px-4 py-2.5 text-muted">{a.startTime && a.endTime ? `${a.startTime} – ${a.endTime}` : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-muted">{a.hoursPerWeek} h</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{formatMoney(a.hourlyRate, false)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-foreground">{formatMoney(assignmentMonthly(a), false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 px-5 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                Aucun créneau : sans emploi du temps, ses heures ne sont ni attendues ni payées.
                <ButtonLink href={`/app/employees/${e.id}/edit`} size="sm" variant="secondary"><Icon name="plus" size={16} /> Ajouter des créneaux</ButtonLink>
              </div>
            )}
          </Card>

          <Card padded={false}>
            <CardHeader title="Remplacements & séances supplémentaires" />
            {sessions.length > 0 ? (
              <ul className="divide-y divide-border">
                {sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className="w-24 shrink-0 font-medium text-foreground">{shortDate(s.date)}</span>
                    <span className="min-w-0 flex-1 text-foreground">{s.label}<span className="block text-xs text-muted">{s.start} – {s.end} · {formatMoney(s.rate, false)} FCFA/h</span></span>
                    {s.date >= today && <Badge tone="brand">À venir</Badge>}
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button type="submit" className="rounded-lg p-1.5 text-muted hover:bg-absent-bg hover:text-absent" aria-label="Annuler cette séance" title="Annuler cette séance"><Icon name="trash" size={16} /></button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-4 text-sm text-muted">Un collègue absent ? Un cours en plus ? Programmez la séance : elle sera payée si {e.firstName} pointe sa présence.</p>
            )}
            {!archived && (
              <SessionForm
                teacherId={e.id}
                defaultRate={e.hourlyRate}
                colleagues={colleagues.filter((c) => c.id !== e.id).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                classes={classes}
                today={today}
              />
            )}
          </Card>

          <Card padded={false}>
            <CardHeader title="Historique des pointages" action={<Link href={`/app/attendance/correct?teacher=${e.id}&date=${today}`} className="text-xs font-medium text-brand-600 hover:underline">Saisir un pointage</Link>} />
            {history.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted">
                <Icon name="clock" size={18} className="text-brand-600" />
                Aucun pointage pour l&apos;instant. Ils apparaîtront dès que {e.firstName} pointera depuis son téléphone.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((r) => {
                  const ph = photos.get(r.id);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
                      <span className="w-24 shrink-0 font-medium text-foreground">{shortDate(r.date)}</span>
                      <span className="flex-1 text-muted">
                        Arrivée {isoToHHMM(r.check_in)} · Départ {isoToHHMM(r.check_out)}
                        {r.method === "manual" && <span className="ml-1 text-xs text-brand-600">(corrigé)</span>}
                      </span>
                      {ph && (
                        <span className="flex gap-1">
                          {ph.in && <a href={ph.in} target="_blank" rel="noopener noreferrer" title="Photo à l'arrivée">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ph.in} alt="Arrivée" className="h-8 w-8 rounded-md object-cover" /></a>}
                          {ph.out && <a href={ph.out} target="_blank" rel="noopener noreferrer" title="Photo au départ">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={ph.out} alt="Départ" className="h-8 w-8 rounded-md object-cover" /></a>}
                        </span>
                      )}
                      {!r.within_geofence ? (
                        <Badge tone="absent">Hors zone</Badge>
                      ) : !r.check_in ? (
                        <Badge tone="off">Arrivée non pointée</Badge>
                      ) : r.late_minutes > 0 ? (
                        <Badge tone="late">Retard · {r.late_minutes} min</Badge>
                      ) : (
                        <Badge tone="present">À l&apos;heure</Badge>
                      )}
                      <Link href={`/app/attendance/correct?teacher=${e.id}&date=${r.date}`} className="text-xs font-medium text-brand-600 hover:underline">Corriger</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {leaves.length > 0 && (
            <Card padded={false}>
              <CardHeader title="Absences & congés" action={<Link href="/app/leaves" className="text-xs font-medium text-brand-600 hover:underline">Gérer</Link>} />
              <ul className="divide-y divide-border">
                {leaves.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className="flex-1 text-foreground">{l.type} · du {numericDate(l.start_date)} au {numericDate(l.end_date)}{l.reason && <span className="block text-xs text-muted">{l.reason}</span>}</span>
                    <Badge tone={LEAVE_TONE[l.status] ?? "off"}>{LEAVE_LABEL[l.status] ?? l.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
