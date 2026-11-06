"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { createLeaveAction, type ActionState } from "@/lib/actions";

const TYPES = ["Maladie", "Congé", "Événement familial", "Formation", "Autre"];

/** La direction enregistre une absence justifiée (acceptée d'office). */
export function LeaveForm({ teachers, today }: { teachers: { id: string; name: string }[]; today: string }) {
  const { state, pending, submit } = useActionForm(createLeaveAction);
  const [v, setV] = useState({ teacherId: "", type: "Maladie", start: today, end: today, reason: "" });
  const cls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={submit()} className="space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Enseignant</span>
          <select name="teacherId" value={v.teacherId} onChange={(e) => setV({ ...v, teacherId: e.target.value })} required className={cls}>
            <option value="" disabled>Choisir…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Motif</span>
          <select name="type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} className={cls}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Précision (facultatif)</span>
          <input name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={300} placeholder="Certificat médical reçu" className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Du</span>
          <input type="date" name="start" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value, end: e.target.value > v.end ? e.target.value : v.end })} required className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Au</span>
          <input type="date" name="end" value={v.end} min={v.start} onChange={(e) => setV({ ...v, end: e.target.value })} required className={cls} />
        </label>
      </div>
      {state.error && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent" role="alert">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-present-bg px-4 py-3 text-sm font-medium text-present" role="status">{state.ok}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Enregistrer l'absence"}</Button>
      </div>
    </form>
  );
}
