"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { createSessionAction, type ActionState } from "@/lib/actions";

/** Ajout d'une séance ponctuelle : remplacement d'un collègue ou séance supplémentaire. */
export function SessionForm({
  teacherId,
  defaultRate,
  colleagues,
  classes,
  today,
}: {
  teacherId: string;
  defaultRate: number;
  colleagues: { id: string; name: string }[];
  classes: string[];
  today: string;
}) {
  const { state, pending, submit } = useActionForm(createSessionAction);
  const [kind, setKind] = useState<"remplacement" | "supplementaire">("remplacement");
  const [v, setV] = useState({ date: today, start: "08:00", end: "10:00", classe: classes[0] ?? "", rate: String(defaultRate || 3000), replacedId: "" });
  const cls = "h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:border-brand-400";

  return (
    <form onSubmit={submit()} className="space-y-3 border-t border-border p-4 sm:p-5">
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium">
        {(
          [
            ["remplacement", "Remplacement"],
            ["supplementaire", "Séance supplémentaire"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 rounded-lg px-3 py-1.5 ${kind === k ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Date</span>
          <input type="date" name="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={cls} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Début</span>
          <input type="time" name="start" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className={cls} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Fin</span>
          <input type="time" name="end" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} className={cls} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Classe</span>
          <input name="classe" value={v.classe} onChange={(e) => setV({ ...v, classe: e.target.value })} list="session-classes" placeholder="6e A" className={cls} required />
          <datalist id="session-classes">{classes.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Taux / heure</span>
          <input type="number" inputMode="numeric" name="rate" min={0} step={250} value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} className={cls} required />
        </label>
        {kind === "remplacement" && (
          <label className="col-span-2 block">
            <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-muted">Enseignant remplacé</span>
            <select name="replacedId" value={v.replacedId} onChange={(e) => setV({ ...v, replacedId: e.target.value })} className={cls}>
              <option value="">— Non précisé —</option>
              {colleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {state.error && <p className="rounded-lg bg-absent-bg px-3 py-2 text-sm font-medium text-absent" role="alert">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-present-bg px-3 py-2 text-sm font-medium text-present" role="status">{state.ok}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          <Icon name="plus" size={16} /> {pending ? "Ajout…" : "Ajouter la séance"}
        </Button>
      </div>
    </form>
  );
}
