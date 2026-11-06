"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { saveSettingsAction, type ActionState } from "@/lib/actions";

const TYPES = ["École primaire", "Collège", "Lycée", "Complexe scolaire", "Institut / Supérieur", "Autre"];
const TOLERANCES = [0, 5, 10, 15, 20, 30];

export function SettingsForm({ initial }: { initial: { name: string; type: string; city: string; phone: string; tolerance: number; faceStrict: boolean } }) {
  const { state, pending, submit } = useActionForm(saveSettingsAction);
  const [v, setV] = useState(initial);
  const cls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={submit()} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Nom de l&apos;établissement</span>
          <input name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={80} className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Type</span>
          <select name="type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} className={cls}>
            <option value="">—</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Ville / quartier</span>
          <input name="city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} maxLength={60} placeholder="Brazzaville, Ouenzé" className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Téléphone de l&apos;établissement</span>
          <input name="phone" type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="06 100 20 30" className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Tolérance de retard</span>
          <select name="tolerance" value={v.tolerance} onChange={(e) => setV({ ...v, tolerance: Number(e.target.value) })} className={cls}>
            {TOLERANCES.map((t) => <option key={t} value={t}>{t === 0 ? "Aucune" : `${t} minutes`}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted">Au-delà, l&apos;arrivée compte comme un retard.</span>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface-2/50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="faceStrict"
            value="1"
            checked={v.faceStrict}
            onChange={(e) => setV({ ...v, faceStrict: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Refuser le pointage si le visage ne correspond pas</span>
            <span className="mt-0.5 block text-xs text-muted">
              Recommandé : personne ne peut pointer à la place d&apos;un collègue. Décoché, le pointage passe quand même mais vous recevez une alerte à vérifier.
            </span>
          </span>
        </label>
      </div>

      {state.error && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent" role="alert">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-present-bg px-4 py-3 text-sm font-medium text-present" role="status">{state.ok}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}><Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
