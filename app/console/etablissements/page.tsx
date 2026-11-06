import { listSchoolRows } from "@/lib/platform";
import { numericDate } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { Panel, Tag, Empty } from "@/components/console/ConsoleUI";
import { ActivatePlanForm, ResetAdminForm, DeleteSchoolForm, NoticeForm } from "@/components/console/ConsoleForms";

export const dynamic = "force-dynamic";

/** Fiche complète de chaque établissement client, avec toutes les actions. */
export default async function SchoolsPage({ searchParams }: PageProps<"/console/etablissements">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const filtre = typeof sp.filtre === "string" ? sp.filtre : "";

  let rows = await listSchoolRows();
  if (q) {
    rows = rows.filter((r) =>
      [r.school.name, r.school.city ?? "", r.school.email ?? "", r.school.id, ...r.admins.map((a) => a.email)].join(" ").toLowerCase().includes(q),
    );
  }
  if (filtre === "payants") rows = rows.filter((r) => r.plan.paid);
  if (filtre === "essai") rows = rows.filter((r) => !r.plan.paid && !r.plan.expired);
  if (filtre === "expires") rows = rows.filter((r) => r.plan.expired);
  if (filtre === "inactifs") rows = rows.filter((r) => !r.active);
  rows = rows.sort((a, b) => b.school.created_at.localeCompare(a.school.created_at));

  const tab = (value: string, label: string) => (
    <a
      key={value}
      href={`/console/etablissements${value ? `?filtre=${value}` : ""}`}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filtre === value ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900"}`}
    >
      {label}
    </a>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {tab("", "Tous")}
          {tab("payants", "Payants")}
          {tab("essai", "Essai")}
          {tab("expires", "Expirés")}
          {tab("inactifs", "Sans activité")}
        </div>
        <form action="/console/etablissements" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Nom, ville, email, référence…"
            className="h-10 w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
          <button type="submit" className="h-10 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800">Chercher</button>
        </form>
      </div>

      <p className="text-xs text-slate-500">
        {rows.length} établissement{rows.length > 1 ? "s" : ""}. Activation : la direction vous écrit sur WhatsApp avec la référence (8 premiers caractères) → paiement Mobile Money →
        « Activer / prolonger ». Un renouvellement prolonge à partir de l&apos;échéance en cours.
      </p>

      <ul className="space-y-4">
        {rows.map((r) => {
          const s = r.school;
          return (
            <li key={s.id} id={s.id} className="scroll-mt-32 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    Réf. {s.id.slice(0, 8).toUpperCase()} · {s.city || "ville ?"} · créé le {numericDate(s.created_at.slice(0, 10))}
                    {s.phone ? ` · ${formatPhone(s.phone)}` : ""}
                    {s.lat != null ? " · localisé" : " · non localisé"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">{r.admins.map((a) => a.email).join(", ") || s.email || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag tone={r.plan.paid ? "ok" : r.plan.expired ? "bad" : "warn"}>
                    {r.plan.paid
                      ? `${r.plan.name} → ${r.plan.until ? numericDate(r.plan.until) : "∞"}${r.daysLeft !== null ? ` (${r.daysLeft} j)` : ""}`
                      : r.plan.expired
                        ? `Expiré (${r.plan.expiredPlanName})`
                        : "Essai gratuit"}
                  </Tag>
                  <Tag tone={r.teachers >= r.maxTeachers ? "warn" : "neutre"}>{r.teachers}/{r.maxTeachers} enseignants</Tag>
                  <Tag tone={r.active ? "ok" : "neutre"}>
                    {r.lastAttendance ? `Dernier pointage ${numericDate(r.lastAttendance)}` : "Aucun pointage"}
                  </Tag>
                </div>
              </div>

              <div className="mt-4 grid gap-5 border-t border-slate-800 pt-4 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Abonnement</p>
                  <ActivatePlanForm schoolId={s.id} currentPlan={r.plan.id} />
                </div>
                <div>
                  <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Accès direction</p>
                  <ResetAdminForm schoolId={s.id} admins={r.admins.map((a) => ({ id: a.id, email: a.email }))} />
                </div>
                <div>
                  <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Message à la direction</p>
                  <NoticeForm schoolId={s.id} />
                </div>
                <details className="self-start">
                  <summary className="cursor-pointer text-[0.7rem] font-semibold uppercase tracking-wide text-red-400/80">Supprimer l&apos;établissement</summary>
                  <p className="mt-2 text-xs text-slate-500">Efface les données, les fichiers et les comptes. Irréversible.</p>
                  <div className="mt-2">
                    <DeleteSchoolForm schoolId={s.id} name={s.name} />
                  </div>
                </details>
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && <Panel><Empty>Aucun établissement ne correspond.</Empty></Panel>}
    </>
  );
}
