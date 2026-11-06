import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { countActiveTeachers, getSchool, listActivity } from "@/lib/db";
import { getSchoolPlan } from "@/lib/plan";
import { numericDate } from "@/lib/time";
import { PLANS, SALES_WHATSAPP } from "@/config/pricing";
import { formatMoney } from "@/config/money";
import { BRAND } from "@/config/brand";

export default async function UpgradePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [used, plan, school, activity] = await Promise.all([
    countActiveTeachers(session.schoolId),
    getSchoolPlan(session.schoolId),
    getSchool(session.schoolId),
    listActivity(session.schoolId, 200),
  ]);
  const ref = session.schoolId.slice(0, 8).toUpperCase();
  const wa = (text: string) => `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
  const history = activity.filter((a) => a.resource?.startsWith("plan:"));
  const pct = Math.min(100, Math.round((used / plan.maxTeachers) * 100));

  return (
    <div className="space-y-6">
      <PageHeader title="Abonnement" subtitle="Votre offre, vos enseignants et comment passer à l'offre supérieure" />

      {plan.expired && plan.until && (
        <Notice tone="warn">Votre abonnement {plan.expiredPlanName} est arrivé à échéance le {numericDate(plan.until)} : l&apos;établissement est revenu aux limites de l&apos;essai gratuit. Les pointages continuent de fonctionner.</Notice>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Offre actuelle</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{plan.paid ? plan.name : "Essai gratuit"}</p>
            <p className="text-sm text-muted">{plan.until ? `Jusqu'au ${numericDate(plan.until)} inclus` : "Sans limite de durée"} · réf. {ref}</p>
          </div>
          <div className="w-full sm:w-72">
            <div className="flex justify-between text-sm"><span className="text-muted">Enseignants actifs</span><span className="font-bold text-foreground">{used} / {plan.maxTeachers}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${pct >= 100 ? "bg-late" : "bg-brand-600"}`} style={{ width: `${pct}%` }} /></div>
            <p className="mt-1.5 text-xs text-muted">Les enseignants archivés ne sont pas comptés.</p>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader title="Passer à l'offre supérieure : comment ça marche" />
        <ol className="grid gap-4 p-5 sm:grid-cols-4">
          {[
            ["Choisissez l'offre", "Selon le nombre d'enseignants de votre établissement."],
            ["Écrivez-nous sur WhatsApp", "Le message est pré-rempli avec le nom de votre école."],
            ["Payez par Mobile Money", "MTN MoMo ou Airtel Money, au mois ou pour l'année."],
            ["Activation le jour même", "La limite augmente : ajoutez vos autres enseignants."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 sm:flex-col">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <span><span className="block text-sm font-semibold text-foreground">{t}</span><span className="block text-xs text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid items-start gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = plan.paid && plan.id === p.id;
          return (
            <Card key={p.id} className={`flex flex-col ${p.highlighted ? "ring-2 ring-brand-500" : ""}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                {current && <span className="rounded-full bg-present-bg px-2.5 py-0.5 text-xs font-semibold text-present">Votre offre</span>}
                {!current && p.highlighted && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Recommandé</span>}
              </div>
              <p className="text-sm text-muted">{p.audience}</p>
              <div className="mt-4">
                {p.priceMonthly !== null ? (
                  <p className="text-3xl font-extrabold text-foreground">{formatMoney(p.priceMonthly, false)}<span className="text-base font-medium text-muted"> {BRAND.currency}/mois</span></p>
                ) : (
                  <p className="text-3xl font-extrabold text-foreground">{p.priceLabel}</p>
                )}
                <p className="mt-1 text-sm text-muted">{p.employeesLabel}</p>
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-present" />{f}</li>
                ))}
              </ul>
              <a
                href={wa(`Bonjour, je souhaite ${current ? "renouveler" : "activer"} l'abonnement ${p.name} de Pointa pour ${school?.name ?? "mon école"} (réf. ${ref}). Nous avons ${used} enseignant(s).`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold ${p.highlighted ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-border text-foreground hover:bg-surface-2"}`}
              >
                <Icon name="message" size={18} /> {p.priceMonthly === null ? "Demander un devis" : current ? "Renouveler" : "Activer ce plan"}
              </a>
            </Card>
          );
        })}
      </div>

      {history.length > 0 && (
        <Card padded={false}>
          <CardHeader title="Historique de l'abonnement" />
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="text-foreground"><span className="font-semibold">{h.actor}</span> {h.action}</span>
                <span className="text-xs text-muted">{new Date(h.created_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Brazzaville" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-sm text-muted">Une question ? WhatsApp +242 06 113 58 07 · Appel +242 06 758 21 84</p>
    </div>
  );
}
