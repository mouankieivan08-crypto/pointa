import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/Icon";
import { MonthSelect } from "@/components/app/MonthSelect";
import { getSession } from "@/lib/auth";
import { currentMonth, isValidMonth, recentMonths, monthLabelOf, capitalize } from "@/lib/time";

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const cur = currentMonth();
  const month = typeof sp.mois === "string" && isValidMonth(sp.mois) && sp.mois <= cur ? sp.mois : cur;
  const months = recentMonths(12).map((v) => ({ value: v, label: capitalize(monthLabelOf(v)) }));

  const reports = [
    { icon: "wallet", title: "État de paie", desc: "Heures vérifiées, retards, absences et montant à payer par enseignant, avec cases de signature.", pdf: `/rapports/paie?mois=${month}`, csv: `/app/export/paie?mois=${month}` },
    { icon: "clock", title: "Relevé des présences", desc: "Jours présents, retards, absences, congés et détail des anomalies du mois.", pdf: `/rapports/pointages?mois=${month}`, csv: `/app/export/pointages?mois=${month}` },
  ];
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-brand-700 hover:bg-surface-2";

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports" subtitle={`${capitalize(monthLabelOf(month))} · PDF à imprimer ou fichier Excel`} action={<MonthSelect value={month} months={months} />} />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title} className="flex flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name={r.icon} size={22} /></span>
            <h3 className="mt-3 font-bold text-foreground">{r.title}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{r.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={r.pdf} className={btn}><Icon name="printer" size={16} /> PDF</Link>
              <a href={r.csv} className={btn}><Icon name="download" size={16} /> Excel</a>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="trophy" size={22} /></span>
          <h3 className="mt-3 font-bold text-foreground">Enseignant du mois</h3>
          <p className="mt-1 flex-1 text-sm text-muted">Classement sur 100 selon la ponctualité, la présence et la régularité.</p>
          <div className="mt-4"><Link href="/app/awards" className={btn}>Voir le classement</Link></div>
        </Card>
        <Card className="flex flex-col">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="history" size={22} /></span>
          <h3 className="mt-3 font-bold text-foreground">Journal d&apos;activité</h3>
          <p className="mt-1 flex-1 text-sm text-muted">Qui a ajouté, modifié ou corrigé quoi, et quand : chaque action est tracée.</p>
          <div className="mt-4"><Link href="/app/activity" className={btn}>Ouvrir le journal</Link></div>
        </Card>
      </div>
    </div>
  );
}
