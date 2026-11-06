"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { setTeacherCodeAction, teacherLogoutAction, type ActionState } from "@/lib/actions";

/**
 * Choix (première connexion) ou changement du code personnel de l'enseignant.
 * Le code remplace le numéro de téléphone comme mot de passe : personne ne peut pointer à sa place.
 */
export function TeacherSetCode({ firstName, mode, onCancel }: { firstName: string; mode: "first" | "change"; onCancel?: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setTeacherCodeAction, {});
  const [v, setV] = useState({ current: "", code: "", confirm: "" });
  const input = "mt-1.5 h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-center text-lg tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-white/40 focus:border-white/60";

  const form = (
    <form action={formAction} className="w-full max-w-xs rounded-3xl bg-white/10 p-6 text-left backdrop-blur">
      <h1 className="text-center text-xl font-extrabold">{mode === "first" ? `Bienvenue ${firstName}` : "Changer mon code"}</h1>
      <p className="mt-2 text-center text-sm text-white/75">
        {mode === "first"
          ? "Choisissez votre code personnel (6 chiffres ou plus). Il remplace votre numéro : personne ne pourra pointer à votre place."
          : "Saisissez votre code actuel, puis le nouveau code."}
      </p>
      {mode === "change" && (
        <label className="mt-5 block text-sm font-medium">
          Code actuel
          <input name="current" type="password" inputMode="numeric" autoComplete="current-password" required value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} className={input} />
        </label>
      )}
      <label className="mt-5 block text-sm font-medium">
        {mode === "first" ? "Mon code" : "Nouveau code"}
        <input name="code" type="password" inputMode="numeric" autoComplete="new-password" required minLength={6} maxLength={12} pattern="\d{6,12}" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.replace(/\D/g, "") })} placeholder="6 chiffres" className={input} />
      </label>
      <label className="mt-4 block text-sm font-medium">
        Confirmer le code
        <input name="confirm" type="password" inputMode="numeric" autoComplete="new-password" required minLength={6} maxLength={12} value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value.replace(/\D/g, "") })} placeholder="6 chiffres" className={input} />
      </label>
      <p className="mt-2 text-[0.72rem] text-white/60">Évitez 123456, les chiffres répétés et votre numéro de téléphone.</p>
      {state.error && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-center text-xs font-medium" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-5 h-12 w-full rounded-xl bg-white text-sm font-bold text-brand-700 transition active:scale-[0.99] disabled:opacity-70">
        {pending ? "Enregistrement…" : "Enregistrer mon code"}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
          Annuler
        </button>
      )}
    </form>
  );

  if (mode === "change") return form;
  return (
    <div className="pointa-gradient fixed inset-0 overflow-y-auto overscroll-contain text-white">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-12 pt-20">
        <Link href="/" className="absolute left-5 top-5"><Logo variant="light" size={22} /></Link>
        <form action={teacherLogoutAction} className="absolute right-5 top-5">
          <button type="submit" className="text-white/70 hover:text-white" aria-label="Déconnexion"><Icon name="logout" size={20} /></button>
        </form>
        {form}
      </div>
    </div>
  );
}
