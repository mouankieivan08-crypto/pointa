import { listSchoolRows, listAllTeachers } from "@/lib/platform";
import { numericDate } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { Panel, Stat, Tag, Empty } from "@/components/console/ConsoleUI";

export const dynamic = "force-dynamic";

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "jamais");

/** Tous les comptes de la plateforme : directions et enseignants. */
export default async function AccountsPage({ searchParams }: PageProps<"/console/comptes">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const rows = await listSchoolRows();
  const teachers = await listAllTeachers(rows);

  const admins = rows
    .flatMap((r) => r.admins.map((a) => ({ ...a, schoolName: r.school.name, schoolId: r.school.id })))
    .filter((a) => !q || `${a.email} ${a.name} ${a.schoolName}`.toLowerCase().includes(q))
    .sort((a, b) => (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? ""));

  const staff = teachers.filter((t) => !q || `${t.name} ${t.phone ?? ""} ${t.schoolName}`.toLowerCase().includes(q));
  const actifs = teachers.filter((t) => t.status === "active").length;
  const avecCode = teachers.filter((t) => t.hasCode).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Comptes de direction" value={admins.length} />
        <Stat label="Enseignants" value={teachers.length} sub={`${actifs} actifs`} />
        <Stat label="Codes personnels choisis" value={avecCode} sub={`${teachers.length - avecCode} en attente`} tone={avecCode ? "ok" : "warn"} />
        <Stat label="Jamais connectés" value={admins.filter((a) => !a.lastSignIn).length} tone="warn" />
      </div>

      <form action="/console/comptes" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email, nom, téléphone, établissement…"
          className="h-10 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button type="submit" className="h-10 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800">Chercher</button>
      </form>

      <Panel title={`Directions (${admins.length})`}>
        {admins.length === 0 ? (
          <Empty>Aucun compte.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Nom</th>
                  <th className="pb-2">Établissement</th>
                  <th className="pb-2">Dernière connexion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 text-slate-100">{a.email}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{a.name || "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{a.schoolName}</td>
                    <td className="py-2.5 text-slate-400">
                      {a.lastSignIn ? dateTime(a.lastSignIn) : <Tag tone="warn">jamais</Tag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Enseignants (${staff.length})`}>
        {staff.length === 0 ? (
          <Empty>Aucun enseignant.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Nom</th>
                  <th className="pb-2">Téléphone</th>
                  <th className="pb-2">Établissement</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2">Ajouté le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {staff.slice(0, 200).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3 text-slate-100">{t.name}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{t.phone ? formatPhone(t.phone) : "—"}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{t.schoolName}</td>
                    <td className="py-2.5 pr-3">
                      <Tag tone={t.status === "active" ? "ok" : "neutre"}>{t.status === "active" ? "actif" : t.status}</Tag>
                      {!t.hasCode && <span className="ml-2 text-[0.7rem] text-amber-400">code non choisi</span>}
                    </td>
                    <td className="py-2.5 text-slate-500">{numericDate(t.created_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staff.length > 200 && <p className="mt-3 text-xs text-slate-500">200 premiers affichés — affinez la recherche.</p>}
          </div>
        )}
      </Panel>
    </>
  );
}
