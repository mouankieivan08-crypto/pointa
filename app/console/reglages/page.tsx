import { platformOwners } from "@/lib/auth";
import { analyticsReady } from "@/lib/analytics";
import { PLANS, PLAN_LIMITS, FREE_TIER_MAX_TEACHERS, SALES_WHATSAPP } from "@/config/pricing";
import { formatMoney } from "@/config/money";
import { Panel, Tag } from "@/components/console/ConsoleUI";
import { OwnerPasswordForm } from "@/components/console/ConsoleForms";

export const dynamic = "force-dynamic";

/** Réglages de la plateforme : qui accède à la console, tarifs en vigueur, état des branchements. */
export default async function ConsoleSettingsPage() {
  const owners = platformOwners();
  const analytics = await analyticsReady();

  const checks = [
    { label: "Base de données", ok: true, note: "Supabase, clé secrète côté serveur uniquement" },
    { label: "Statistiques de visite", ok: analytics, note: analytics ? "actives" : "exécuter supabase/migration-analytics.sql" },
    { label: "Reconnaissance du visage", ok: true, note: "modèles servis depuis /models, comparaison sur l'appareil" },
    { label: "Rappels automatiques", ok: !!process.env.CRON_SECRET, note: "cron externe à brancher sur /api/cron/notify" },
    { label: "Clé d'accès de secours", ok: !!process.env.CONSOLE_KEY, note: "CONSOLE_KEY" },
    { label: "Propriétaires déclarés", ok: owners.length > 0, note: owners.length ? `${owners.length} email(s)` : "CONSOLE_EMAILS vide" },
  ];

  return (
    <>
      <Panel title="Accès à la console">
        {owners.length === 0 ? (
          <p className="text-sm text-amber-400">
            Aucun propriétaire déclaré : seule la clé d&apos;accès ouvre la console. Ajoutez la variable d&apos;environnement{" "}
            <code className="text-slate-200">CONSOLE_EMAILS</code> (emails séparés par des virgules).
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300">Ces comptes peuvent ouvrir la console avec leur email et leur mot de passe :</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {owners.map((o) => <li key={o}><Tag tone="info">{o}</Tag></li>)}
            </ul>
            <div className="mt-5 border-t border-slate-800 pt-4">
              <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Changer le mot de passe d&apos;un propriétaire</p>
              <OwnerPasswordForm emails={owners} />
              <p className="mt-2 text-xs text-slate-500">
                C&apos;est le même mot de passe que pour l&apos;espace de son établissement. Il ouvre les données de <b>tous</b> les établissements : choisissez-en un long.
              </p>
            </div>
          </>
        )}
      </Panel>

      <Panel title="État des branchements">
        <ul className="divide-y divide-slate-800">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-slate-200">{c.label}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{c.note}</span>
                <Tag tone={c.ok ? "ok" : "warn"}>{c.ok ? "OK" : "à faire"}</Tag>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tarifs en vigueur">
        <ul className="divide-y divide-slate-800">
          <li className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-slate-200">Essai gratuit</span>
            <span className="text-slate-400">{FREE_TIER_MAX_TEACHERS} enseignants · sans échéance</span>
          </li>
          {PLANS.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-200">{p.name}</span>
              <span className="text-slate-400">
                {PLAN_LIMITS[p.id]} enseignants · {p.priceMonthly ? `${formatMoney(p.priceMonthly, false)} FCFA / mois` : "sur devis"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Les tarifs se modifient dans <code className="text-slate-300">config/pricing.ts</code>. Paiement et activation : WhatsApp {SALES_WHATSAPP}, puis « Activer / prolonger »
          sur la fiche de l&apos;établissement.
        </p>
      </Panel>
    </>
  );
}
