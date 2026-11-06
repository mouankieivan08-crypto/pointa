import Link from "next/link";
import { listSchoolRows, platformStats, globalActivity } from "@/lib/platform";
import { getAudience } from "@/lib/analytics";
import { formatMoney } from "@/config/money";
import { numericDate, monthLabelOf } from "@/lib/time";
import { Panel, Stat, Tag, Bars, SchoolLink, Empty } from "@/components/console/ConsoleUI";

export const dynamic = "force-dynamic";

/** Vue d'ensemble de la plateforme : l'essentiel en un écran. */
export default async function ConsoleHome() {
  const rows = await listSchoolRows();
  const [stats, audience, journal] = await Promise.all([platformStats(rows), getAudience(14), globalActivity(rows, 12)]);

  const recent = [...rows].sort((a, b) => b.school.created_at.localeCompare(a.school.created_at)).slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Établissements" value={stats.schools} sub={`${stats.schoolsActive} actifs ces 3 semaines`} />
        <Stat label="Enseignants gérés" value={stats.teachers} sub={`${stats.adminAccounts} comptes de direction`} />
        <Stat label="Revenu mensuel" value={formatMoney(stats.mrr, false)} sub={`${formatMoney(stats.arr, false)} FCFA / an`} tone="ok" />
        <Stat label="Abonnements payants" value={`${stats.paying}/${stats.schools}`} sub={`${stats.conversion} % de conversion`} tone={stats.paying ? "ok" : "warn"} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pointages aujourd'hui" value={stats.punchesToday} />
        <Stat label="Pointages ce mois" value={stats.punchesMonth} />
        <Stat label="En essai gratuit" value={stats.trial} tone="warn" />
        <Stat label="Abonnements expirés" value={stats.expired} tone={stats.expired ? "bad" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Nouveaux établissements par mois">
          <Bars data={stats.signups.map((s) => ({ label: monthLabelOf(s.month).slice(0, 3), value: s.count }))} />
        </Panel>

        <Panel
          title="Visites du site vitrine (14 jours)"
          action={<Link href="/console/audience" className="text-xs text-indigo-300 hover:underline">Détail</Link>}
        >
          {audience.ready ? (
            <>
              <Bars data={audience.daily.map((d) => ({ label: d.date.slice(8), value: d.vues }))} />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <span><b className="text-slate-100">{audience.totalViews}</b> vues</span>
                <span><b className="text-slate-100">{audience.uniqueVisitors}</b> visiteurs</span>
                <span><b className="text-slate-100">{audience.whatsappClicks}</b> clics WhatsApp</span>
                <span><b className="text-slate-100">{audience.signups}</b> inscriptions</span>
              </div>
            </>
          ) : (
            <Empty>
              Statistiques à activer : exécutez <code className="text-slate-300">supabase/migration-analytics.sql</code> dans Supabase.
            </Empty>
          )}
        </Panel>
      </div>

      {stats.expiring.length > 0 && (
        <Panel title="Abonnements à relancer (30 jours)" action={<Link href="/console/abonnements" className="text-xs text-indigo-300 hover:underline">Gérer</Link>}>
          <ul className="divide-y divide-slate-800">
            {stats.expiring.map((r) => (
              <li key={r.school.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <SchoolLink id={r.school.id} name={r.school.name} />
                <span className="flex items-center gap-2">
                  <Tag tone={(r.daysLeft ?? 0) <= 7 ? "bad" : "warn"}>
                    {(r.daysLeft ?? 0) < 0 ? "Expiré" : `${r.daysLeft} j`}
                  </Tag>
                  <span className="text-xs text-slate-500">{r.plan.name} · échéance {r.plan.until ? numericDate(r.plan.until) : "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Dernières inscriptions" action={<Link href="/console/etablissements" className="text-xs text-indigo-300 hover:underline">Tout voir</Link>}>
          <ul className="divide-y divide-slate-800">
            {recent.map((r) => (
              <li key={r.school.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <SchoolLink id={r.school.id} name={r.school.name} />
                  <span className="block truncate text-xs text-slate-500">{r.admins[0]?.email ?? r.school.email ?? "—"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Tag tone={r.plan.paid ? "ok" : r.plan.expired ? "bad" : "warn"}>{r.plan.paid ? r.plan.name : r.plan.expired ? "Expiré" : "Essai"}</Tag>
                  <span className="text-xs text-slate-500">{numericDate(r.school.created_at.slice(0, 10))}</span>
                </span>
              </li>
            ))}
            {recent.length === 0 && <Empty>Aucun établissement inscrit.</Empty>}
          </ul>
        </Panel>

        <Panel title="Activité récente" action={<Link href="/console/journal" className="text-xs text-indigo-300 hover:underline">Tout voir</Link>}>
          <ul className="divide-y divide-slate-800">
            {journal.map((a) => (
              <li key={a.id} className="py-2.5 text-sm">
                <p className="text-slate-300">
                  <span className="font-medium text-slate-100">{a.actor || "Système"}</span> {a.action}.
                </p>
                <p className="text-[0.7rem] text-slate-500">{a.schoolName} · {new Date(a.created_at).toLocaleString("fr-FR")}</p>
              </li>
            ))}
            {journal.length === 0 && <Empty>Rien pour l&apos;instant.</Empty>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
