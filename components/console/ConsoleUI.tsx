import Link from "next/link";

/** Briques d'affichage de la console (thème sombre, lecture rapide). */

export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/50 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
          {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[0.7rem] text-slate-500">{sub}</p>}
    </div>
  );
}

export function Tag({ children, tone = "neutre" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "neutre" | "info" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-400"
        : tone === "bad"
          ? "bg-red-500/15 text-red-400"
          : tone === "info"
            ? "bg-indigo-500/15 text-indigo-300"
            : "bg-slate-800 text-slate-300";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}

/** Histogramme simple (barres verticales), sans dépendance. */
export function Bars({ data, format }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="group flex min-w-0 flex-1 flex-col items-center justify-end" title={`${d.label} : ${format ? format(d.value) : d.value}`}>
          <span className="mb-1 text-[0.6rem] tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100">{d.value}</span>
          <div className="w-full rounded-t bg-indigo-500/80 transition group-hover:bg-indigo-400" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <span className="mt-1 w-full truncate text-center text-[0.6rem] text-slate-600">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SchoolLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/console/etablissements#${id}`} className="font-medium text-slate-100 hover:text-indigo-300">
      {name}
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}
