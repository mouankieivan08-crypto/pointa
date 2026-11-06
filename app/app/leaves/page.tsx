import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/Icon";
import { LeaveForm } from "@/components/app/LeaveForm";
import { getSession } from "@/lib/auth";
import { listLeaves, listTeachers } from "@/lib/db";
import { decideLeaveAction, deleteLeaveAction } from "@/lib/actions";
import { localToday, numericDate } from "@/lib/time";

const STATUS_TONE: Record<string, "late" | "present" | "absent"> = { pending: "late", accepted: "present", refused: "absent" };
const STATUS_LABEL: Record<string, string> = { pending: "En attente", accepted: "Acceptée", refused: "Refusée" };

export default async function LeavesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [leaves, teachers] = await Promise.all([listLeaves(session.schoolId), listTeachers(session.schoolId, { includeArchived: true })]);
  const byId = new Map(teachers.map((t) => [t.id, t]));
  const pending = leaves.filter((l) => l.status === "pending");
  const others = leaves.filter((l) => l.status !== "pending");
  const period = (s: string, e: string) => (s === e ? `le ${numericDate(s)}` : `du ${numericDate(s)} au ${numericDate(e)}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Absences & congés" subtitle="Une absence justifiée acceptée n'est pas comptée comme absence (et n'est pas payée)." />

      {pending.length > 0 && (
        <Card padded={false}>
          <CardHeader title={`Demandes en attente (${pending.length})`} />
          <ul className="divide-y divide-border">
            {pending.map((l) => {
              const t = byId.get(l.teacher_id);
              return (
                <li key={l.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {t && <Avatar initials={(t.firstName[0] + t.lastName[0]).toUpperCase()} color={t.color} size={36} photoUrl={t.photoUrl} />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{t ? `${t.firstName} ${t.lastName}` : "Enseignant"} · {l.type}</p>
                      <p className="text-xs text-muted">{period(l.start_date, l.end_date)}{l.reason ? ` — ${l.reason}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={decideLeaveAction}>
                      <input type="hidden" name="leaveId" value={l.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-present px-3.5 text-sm font-semibold text-white hover:opacity-90"><Icon name="check" size={16} /> Accepter</button>
                    </form>
                    <form action={decideLeaveAction}>
                      <input type="hidden" name="leaveId" value={l.id} />
                      <input type="hidden" name="decision" value="refused" />
                      <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-absent hover:bg-absent-bg"><Icon name="x" size={16} /> Refuser</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader title="Enregistrer une absence justifiée" />
          {teachers.some((t) => t.status !== "archived") ? (
            <LeaveForm teachers={teachers.filter((t) => t.status !== "archived").map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))} today={localToday()} />
          ) : (
            <p className="px-5 py-5 text-sm text-muted">Ajoutez d&apos;abord vos enseignants.</p>
          )}
        </Card>

        <Card padded={false} className="lg:col-span-3">
          <CardHeader title="Historique" />
          {others.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">
              Aucune absence enregistrée. Les enseignants peuvent aussi signaler une absence depuis leur espace : vous la verrez ici pour l&apos;accepter ou la refuser.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {others.map((l) => {
                const t = byId.get(l.teacher_id);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{t ? `${t.firstName} ${t.lastName}` : "Enseignant"} · {l.type}</span>
                      <span className="block text-xs text-muted">{period(l.start_date, l.end_date)}{l.reason ? ` — ${l.reason}` : ""}</span>
                    </span>
                    <Badge tone={STATUS_TONE[l.status] ?? "off"}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
                    <form action={deleteLeaveAction}>
                      <input type="hidden" name="leaveId" value={l.id} />
                      <button type="submit" className="rounded-lg p-1.5 text-muted hover:bg-absent-bg hover:text-absent" aria-label="Supprimer" title="Supprimer"><Icon name="trash" size={16} /></button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
