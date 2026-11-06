"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { requestLeaveAction, type ActionState } from "@/lib/actions";

const TYPES = ["Maladie", "Congé", "Événement familial", "Formation", "Autre"];

/** L'enseignant signale une absence à la direction (depuis son téléphone). */
export function LeaveRequest({ today, onDone }: { today: string; onDone: () => void }) {
  const { state, pending, submit } = useActionForm(requestLeaveAction);
  const [v, setV] = useState({ type: "Maladie", start: today, end: today, reason: "" });
  const cls = "mt-1.5 h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-base text-white outline-none focus:border-white/60 [color-scheme:dark]";

  if (state.ok) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white/10 p-5 text-center backdrop-blur">
        <p className="font-semibold">{state.ok}</p>
        <p className="mt-1 text-sm text-white/70">Vous verrez sa réponse dans votre espace.</p>
        <button type="button" onClick={onDone} className="mt-4 h-11 w-full rounded-xl bg-white text-sm font-bold text-brand-700">Retour</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit()} className="w-full max-w-sm space-y-3 rounded-2xl bg-white/10 p-5 text-left backdrop-blur">
      <h2 className="text-lg font-bold">Signaler une absence</h2>
      <label className="block text-sm font-medium">
        Motif
        <select name="type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} className={cls}>
          {TYPES.map((t) => <option key={t} className="text-foreground">{t}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-medium">
          Du
          <input type="date" name="start" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value, end: e.target.value > v.end ? e.target.value : v.end })} required className={cls} />
        </label>
        <label className="block text-sm font-medium">
          Au
          <input type="date" name="end" value={v.end} min={v.start} onChange={(e) => setV({ ...v, end: e.target.value })} required className={cls} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Précision (facultatif)
        <input name="reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} maxLength={300} placeholder="Ex : consultation à l'hôpital" className={`${cls} placeholder:text-white/40`} />
      </label>
      {state.error && <p className="rounded-lg bg-white/15 px-3 py-2 text-xs font-medium" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-white text-sm font-bold text-brand-700 disabled:opacity-70">
        {pending ? "Envoi…" : "Envoyer à la direction"}
      </button>
      <button type="button" onClick={onDone} className="h-11 w-full rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">Annuler</button>
    </form>
  );
}
