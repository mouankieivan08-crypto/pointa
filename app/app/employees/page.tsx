import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { listTeachers, getSchool } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { getSchoolConfig } from "@/lib/school-config";
import { teacherMonthlyQuota } from "@/lib/quota";
import { formatPhone } from "@/lib/phone";
import { inviteLink } from "@/lib/invite";
import { appOrigin } from "@/lib/url";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function EmployeesPage({ searchParams }: PageProps<"/app/employees">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = rawQ?.trim().slice(0, 60) ?? "";
  const archivedView = sp.statut === "archives";

  const [all, school, plan, config, origin] = await Promise.all([
    listTeachers(session.schoolId, { includeArchived: true }),
    getSchool(session.schoolId),
    getSchoolPlan(session.schoolId),
    getSchoolConfig(session.schoolId),
    appOrigin(),
  ]);
  const v = config.structure;
  const active = all.filter((e) => e.status !== "archived");
  const archived = all.filter((e) => e.status === "archived");
  const base = archivedView ? archived : active;
  // Recherche : nom, matière, téléphone ou matricule, sans tenir compte des accents.
  const digits = q.replace(/\D/g, "");
  const shown = q
    ? base.filter((e) => norm(`${e.firstName} ${e.lastName} ${e.subject} ${e.matricule}`).includes(norm(q)) || (digits.length >= 3 && e.phone.replace(/\D/g, "").includes(digits)))
    : base;
  const full = active.length >= plan.maxTeachers;

  return (
    <div className="space-y-6">
      <PageHeader
        title={v.staffMany}
        subtitle={`${active.length} / ${plan.maxTeachers} ${v.staffOne}(s) actif(s) · ${plan.paid ? `abonnement ${plan.name}` : "essai gratuit"}`}
        action={
          active.length > 0 && !full ? (
            <ButtonLink href="/app/employees/new" size="md"><Icon name="plus" size={18} /> Ajouter un {v.staffOne}</ButtonLink>
          ) : undefined
        }
      />

      {full && (
        <Notice tone="info" action={<ButtonLink href="/app/upgrade" size="sm">Voir les abonnements</ButtonLink>}>
          Limite atteinte ({active.length}/{plan.maxTeachers}). Pour ajouter un {v.staffOne}, activez un abonnement — ou archivez un {v.staffOne} qui ne travaille plus chez vous.
        </Notice>
      )}

      {(archived.length > 0 || archivedView) && (
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium sm:w-fit">
          <Link href="/app/employees" className={`flex-1 rounded-lg px-4 py-1.5 text-center ${!archivedView ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}>Actifs ({active.length})</Link>
          <Link href="/app/employees?statut=archives" className={`flex-1 rounded-lg px-4 py-1.5 text-center ${archivedView ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}>Archivés ({archived.length})</Link>
        </div>
      )}

      {base.length === 0 ? (
        archivedView ? (
          <EmptyState icon="archive" title="Aucun profil archivé" description={`Les ${v.staffMany.toLowerCase()} qui ne travaillent plus chez vous peuvent être archivés : leur historique est conservé et leur place est libérée.`} />
        ) : (
          <EmptyState
            icon="users"
            title={`Aucun ${v.staffOne} pour le moment`}
            description={`Ajoutez votre premier ${v.staffOne} (téléphone, matière, ${v.groupMany.toLowerCase()} et taux horaire) pour commencer à suivre ses heures.`}
            action={<ButtonLink href="/app/employees/new"><Icon name="plus" size={18} /> Ajouter un {v.staffOne}</ButtonLink>}
          />
        )
      ) : (
        <Card padded={false} className="overflow-hidden">
          {q && (
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm">
              <span className="text-muted">
                {shown.length} résultat(s) pour « <span className="font-medium text-foreground">{q}</span> »
              </span>
              <Link href="/app/employees" className="font-medium text-brand-600 hover:underline">Effacer</Link>
            </div>
          )}

          {/* Mobile : cartes */}
          <ul className="divide-y divide-border md:hidden">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/app/employees/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={40} photoUrl={e.photoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{e.firstName} {e.lastName}</span>
                    <span className="block truncate text-xs text-muted">{e.subject || "—"} · {formatPhone(e.phone)}</span>
                  </span>
                </Link>
                {!archivedView && (
                  <a href={inviteLink({ origin, schoolName: school?.name ?? "Votre établissement", firstName: e.firstName, phone: e.phone, hasCode: !!e.hasCode })} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-present hover:bg-present-bg" aria-label={`Envoyer son accès à ${e.firstName} par WhatsApp`}>
                    <Icon name="message" size={20} />
                  </a>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Aucun résultat pour cette recherche.</li>}
          </ul>

          {/* Écran large : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{v.staffOne}</th>
                  <th className="px-4 py-3 font-semibold">Matière</th>
                  <th className="px-4 py-3 font-semibold">{v.groupMany}</th>
                  <th className="px-4 py-3 text-right font-semibold">Quota / mois</th>
                  <th className="px-4 py-3 font-semibold">Accès</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/app/employees/${e.id}`} className="flex items-center gap-3">
                        <Avatar initials={(e.firstName[0] + e.lastName[0]).toUpperCase()} color={e.color} size={36} photoUrl={e.photoUrl} />
                        <div>
                          <p className="font-semibold text-foreground">{e.firstName} {e.lastName}</p>
                          <p className="text-xs text-muted">{e.matricule} · {formatPhone(e.phone)}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{e.subject || "—"}</td>
                    <td className="px-4 py-3 text-muted">{e.assignments.length ? [...new Set(e.assignments.map((a) => a.classe))].join(", ") : "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{e.weeklyQuotaHours ? `${teacherMonthlyQuota(e)} h` : "—"}</td>
                    <td className="px-4 py-3">{e.hasCode ? <Badge tone="present">Code choisi</Badge> : <Badge tone="off">Pas encore connecté</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!archivedView && (
                          <a href={inviteLink({ origin, schoolName: school?.name ?? "Votre établissement", firstName: e.firstName, phone: e.phone, hasCode: !!e.hasCode })} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-present hover:bg-present-bg">
                            <Icon name="message" size={16} /> Accès
                          </a>
                        )}
                        <ButtonLink href={`/app/employees/${e.id}`} variant="ghost" size="sm">Voir</ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">Aucun résultat pour cette recherche.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
