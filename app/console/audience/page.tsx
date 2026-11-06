import { getAudience } from "@/lib/analytics";
import { listSchoolRows, platformStats } from "@/lib/platform";
import { Panel, Stat, Bars, Empty } from "@/components/console/ConsoleUI";

export const dynamic = "force-dynamic";

/** Audience du site vitrine : visites, provenance, et entonnoir jusqu'à l'inscription. */
export default async function AudiencePage() {
  const [audience, rows] = await Promise.all([getAudience(30), listSchoolRows()]);
  const stats = await platformStats(rows);

  if (!audience.ready) {
    return (
      <Panel title="Statistiques de visite">
        <p className="text-sm text-slate-300">Le comptage des visites n&apos;est pas encore activé.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Ouvrez Supabase → SQL Editor → New query.</li>
          <li>Collez le contenu de <code className="text-slate-200">supabase/migration-analytics.sql</code>.</li>
          <li>Cliquez sur Run, puis rechargez cette page.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Aucune adresse IP n&apos;est conservée : seules la page, la provenance et le type d&apos;appareil sont enregistrés.
        </p>
      </Panel>
    );
  }

  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vues (30 j)" value={audience.totalViews} sub={`${audience.today.vues} aujourd'hui`} />
        <Stat label="Visiteurs uniques" value={audience.uniqueVisitors} sub={`${audience.today.visiteurs} aujourd'hui`} />
        <Stat label="Clics WhatsApp" value={audience.whatsappClicks} sub={rate(audience.whatsappClicks, audience.uniqueVisitors) + " des visiteurs"} tone="ok" />
        <Stat label="Inscriptions" value={audience.signups} sub={rate(audience.signups, audience.uniqueVisitors) + " des visiteurs"} tone="ok" />
      </div>

      <Panel title="Visites par jour (30 derniers jours)">
        <Bars data={audience.daily.map((d) => ({ label: d.date.slice(8), value: d.vues }))} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="D'où viennent les visiteurs">
          {audience.sources.length === 0 ? (
            <Empty>Pas encore de données.</Empty>
          ) : (
            <ul className="divide-y divide-slate-800">
              {audience.sources.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-slate-200">{s.name}</span>
                  <span className="tabular-nums text-slate-400">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Appareils">
          {audience.devices.length === 0 ? (
            <Empty>Pas encore de données.</Empty>
          ) : (
            <ul className="divide-y divide-slate-800">
              {audience.devices.map((d) => (
                <li key={d.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize text-slate-200">{d.name}</span>
                  <span className="tabular-nums text-slate-400">{d.count} · {rate(d.count, audience.totalViews)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Pages les plus vues">
          {audience.pages.length === 0 ? (
            <Empty>Pas encore de données.</Empty>
          ) : (
            <ul className="divide-y divide-slate-800">
              {audience.pages.map((p) => (
                <li key={p.path} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-slate-200">{p.path}</span>
                  <span className="tabular-nums text-slate-400">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Entonnoir — du visiteur au client">
        <ul className="space-y-3 text-sm">
          <FunnelStep label="Visiteurs du site" value={audience.uniqueVisitors} max={audience.uniqueVisitors} />
          <FunnelStep label="Clics vers WhatsApp" value={audience.whatsappClicks} max={audience.uniqueVisitors} />
          <FunnelStep label="Comptes créés" value={audience.signups} max={audience.uniqueVisitors} />
          <FunnelStep label="Abonnements payants (total)" value={stats.paying} max={audience.uniqueVisitors} />
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Les visites sont comptées une fois par onglet. Les clics WhatsApp sont ceux des liens de la vitrine et de la page Abonnement.
        </p>
      </Panel>
    </>
  );
}

function FunnelStep({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <li>
      <div className="flex items-center justify-between text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums"><b className="text-slate-100">{value}</b> · {pct} %</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </li>
  );
}
