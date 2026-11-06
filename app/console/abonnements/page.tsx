import { listSchoolRows, platformStats } from "@/lib/platform";
import { formatMoney } from "@/config/money";
import { PLANS, PLAN_NAMES, type PlanId } from "@/config/pricing";
import { numericDate } from "@/lib/time";
import { Panel, Stat, Tag, Empty } from "@/components/console/ConsoleUI";
import { ActivatePlanForm } from "@/components/console/ConsoleForms";

export const dynamic = "force-dynamic";

/** Suivi commercial : qui paie, combien, jusqu'à quand, et qui est à relancer. */
export default async function SubscriptionsPage() {
  const rows = await listSchoolRows();
  const stats = await platformStats(rows);

  const byPlan = new Map<string, { count: number; revenue: number }>();
  for (const p of PLANS) byPlan.set(p.id, { count: 0, revenue: 0 });
  byPlan.set("essai", { count: 0, revenue: 0 });
  for (const r of rows) {
    const key = r.plan.paid ? r.plan.id : "essai";
    const slot = byPlan.get(key) ?? { count: 0, revenue: 0 };
    slot.count++;
    slot.revenue += r.monthly;
    byPlan.set(key, slot);
  }

  const paying = rows.filter((r) => r.plan.paid).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  const toRelaunch = rows.filter((r) => r.plan.expired || (!r.plan.paid && r.teachers >= r.maxTeachers));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenu mensuel" value={`${formatMoney(stats.mrr, false)} F`} tone="ok" />
        <Stat label="Revenu annualisé" value={`${formatMoney(stats.arr, false)} F`} />
        <Stat label="Payants" value={stats.paying} sub={`${stats.conversion} % du parc`} />
        <Stat label="À relancer" value={toRelaunch.length} tone={toRelaunch.length ? "warn" : undefined} />
      </div>

      <Panel title="Répartition par offre">
        <ul className="divide-y divide-slate-800">
          {[...byPlan.entries()].map(([id, v]) => (
            <li key={id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-slate-200">{id === "essai" ? "Essai gratuit" : PLAN_NAMES[id as PlanId] ?? id}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{v.count} établissement{v.count > 1 ? "s" : ""}</span>
                <span className="w-28 text-right tabular-nums text-slate-100">{v.revenue ? `${formatMoney(v.revenue, false)} F` : "—"}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Abonnements en cours">
        {paying.length === 0 ? (
          <Empty>Aucun abonnement payant pour l&apos;instant.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Établissement</th>
                  <th className="pb-2">Offre</th>
                  <th className="pb-2">Enseignants</th>
                  <th className="pb-2">Échéance</th>
                  <th className="pb-2 text-right">Mensuel</th>
                  <th className="pb-2">Prolonger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paying.map((r) => (
                  <tr key={r.school.id} className="align-middle">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-100">{r.school.name}</p>
                      <p className="text-[0.7rem] text-slate-500">Réf. {r.school.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="py-3 pr-3">{r.plan.name}</td>
                    <td className="py-3 pr-3 tabular-nums">{r.teachers}/{r.maxTeachers}</td>
                    <td className="py-3 pr-3">
                      <Tag tone={(r.daysLeft ?? 99) <= 7 ? "bad" : (r.daysLeft ?? 99) <= 30 ? "warn" : "ok"}>
                        {r.plan.until ? numericDate(r.plan.until) : "∞"}{r.daysLeft !== null ? ` · ${r.daysLeft} j` : ""}
                      </Tag>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{formatMoney(r.monthly, false)} F</td>
                    <td className="py-3"><ActivatePlanForm schoolId={r.school.id} currentPlan={r.plan.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="À relancer — expirés ou bloqués par la limite">
        {toRelaunch.length === 0 ? (
          <Empty>Personne à relancer.</Empty>
        ) : (
          <ul className="divide-y divide-slate-800">
            {toRelaunch.map((r) => (
              <li key={r.school.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-slate-100">{r.school.name}</span>
                  <span className="block truncate text-xs text-slate-500">{r.admins[0]?.email ?? r.school.email ?? "—"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Tag tone={r.plan.expired ? "bad" : "warn"}>{r.plan.expired ? `Expiré le ${r.plan.until ? numericDate(r.plan.until) : "?"}` : "Limite d'essai atteinte"}</Tag>
                  <Tag>{r.teachers}/{r.maxTeachers} enseignants</Tag>
                </span>
                <ActivatePlanForm schoolId={r.school.id} currentPlan={r.plan.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
