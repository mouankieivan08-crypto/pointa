"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { STRUCTURES, structureOf, type StructureKind } from "@/config/structures";
import { saveStructureAction, type ActionState } from "@/lib/actions";

/** Type de structure + niveaux : adapte le vocabulaire de Pointa (classes / promotions / groupes). */
export function StructureForm({ initial }: { initial: { kind: StructureKind; levels: string[] } }) {
  const { state, pending, submit } = useActionForm(saveStructureAction);
  const [kind, setKind] = useState<StructureKind>(initial.kind);
  const [levels, setLevels] = useState<string[]>(initial.levels);
  const [custom, setCustom] = useState("");
  const structure = structureOf(kind);

  const toggle = (l: string) => setLevels((v) => (v.includes(l) ? v.filter((x) => x !== l) : [...v, l]));
  const add = () => {
    const v = custom.trim();
    if (v && !levels.includes(v)) setLevels((l) => [...l, v]);
    setCustom("");
  };

  return (
    <form onSubmit={submit()} className="space-y-4 p-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="levels" value={levels.join(",")} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">Type de structure</span>
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as StructureKind;
            setKind(k);
            setLevels(structureOf(k).levels);
          }}
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400"
        >
          {STRUCTURES.map((s) => <option key={s.kind} value={s.kind}>{s.label}</option>)}
        </select>
        <span className="mt-1 block text-xs text-muted">Adapte le vocabulaire : {structure.staffMany.toLowerCase()}, {structure.groupMany.toLowerCase()}.</span>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-foreground">{structure.groupMany}</span>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...structure.levels, ...levels])].map((l) => (
            <button key={l} type="button" onClick={() => toggle(l)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${levels.includes(l) ? "border-brand-500 bg-brand-600 text-white" : "border-border bg-surface text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={`Ajouter : ${structure.example}`}
            maxLength={40}
            className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400"
          />
          <button type="button" onClick={add} className="h-11 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-2">Ajouter</button>
        </div>
      </div>

      {state.error && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent" role="alert">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-present-bg px-4 py-3 text-sm font-medium text-present" role="status">{state.ok}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
