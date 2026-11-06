"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { correctAttendanceAction, type ActionState } from "@/lib/actions";

/** Correction d'un pointage par la direction (motif obligatoire, tracé au journal). */
export function CorrectionForm({ teacherId, date, initial }: { teacherId: string; date: string; initial: { arrival: string; departure: string; valid: boolean } }) {
  const { state, pending, submit } = useActionForm(correctAttendanceAction);
  const [v, setV] = useState(initial);
  const [reason, setReason] = useState("");
  const cls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={submit()} className="space-y-4 p-5">
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="date" value={date} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Arrivée</span>
          <input type="time" name="arrival" value={v.arrival} onChange={(e) => setV({ ...v, arrival: e.target.value })} className={cls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Départ</span>
          <input type="time" name="departure" value={v.departure} onChange={(e) => setV({ ...v, departure: e.target.value })} className={cls} />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-border p-3">
        <input type="checkbox" name="valid" checked={v.valid} onChange={(e) => setV({ ...v, valid: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-600" />
        <span className="text-sm text-foreground">
          Présence validée dans l&apos;établissement
          <span className="block text-xs text-muted">Décochez si l&apos;enseignant n&apos;était pas à l&apos;établissement : les heures ne seront pas payées.</span>
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">Motif de la correction</span>
        <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={200} placeholder="Ex : téléphone déchargé, départ confirmé par le surveillant" className={cls} />
        <span className="mt-1 block text-xs text-muted">Conservé au journal d&apos;activité. Laissez les deux heures vides pour supprimer le pointage de ce jour.</span>
      </label>
      {state.error && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent" role="alert">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Enregistrer la correction"}
        </Button>
      </div>
    </form>
  );
}
