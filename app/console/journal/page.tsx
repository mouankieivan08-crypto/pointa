import { listSchoolRows, globalActivity } from "@/lib/platform";
import { Panel, Empty } from "@/components/console/ConsoleUI";

export const dynamic = "force-dynamic";

/** Journal de toute la plateforme : ce que font les établissements, en clair. */
export default async function JournalPage({ searchParams }: PageProps<"/console/journal">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const rows = await listSchoolRows();
  let log = await globalActivity(rows, 300);
  if (q) log = log.filter((a) => `${a.actor ?? ""} ${a.action} ${a.schoolName}`.toLowerCase().includes(q));

  const byDay = new Map<string, typeof log>();
  for (const a of log) {
    const d = a.created_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }

  return (
    <>
      <form action="/console/journal" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Filtrer : établissement, action, personne…"
          className="h-10 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button type="submit" className="h-10 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800">Filtrer</button>
      </form>

      {byDay.size === 0 && <Panel><Empty>Aucune action enregistrée.</Empty></Panel>}

      {[...byDay.entries()].map(([day, items]) => (
        <Panel key={day} title={new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
          <ul className="divide-y divide-slate-800">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-100">{a.actor || "Système"}</span> <span className="text-slate-300">{a.action}.</span>
                </span>
                <span className="text-xs text-slate-500">
                  {a.schoolName} · {new Date(a.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </>
  );
}
