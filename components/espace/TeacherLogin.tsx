"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { teacherLoginAction, type TeacherLoginState } from "@/lib/actions";

/** Connexion de l'enseignant : numéro de téléphone + code personnel (ou numéro à la 1re connexion). */
export function TeacherLogin({ expired = false }: { expired?: boolean }) {
  const [state, formAction, pending] = useActionState<TeacherLoginState, FormData>(teacherLoginAction, {});
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const input = "mt-1.5 h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-base text-white outline-none placeholder:text-white/50 focus:border-white/60";

  return (
    <div className="pointa-gradient fixed inset-0 overflow-y-auto overscroll-contain text-white">
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 pb-12 pt-20">
        <Link href="/" className="absolute left-5 top-5"><Logo variant="light" size={24} /></Link>
        <form action={formAction} className="w-full max-w-xs rounded-3xl bg-white/10 p-6 backdrop-blur">
          <h1 className="text-center text-xl font-extrabold">Espace enseignant</h1>
          <p className="mt-1 text-center text-sm text-white/70">Connectez-vous pour pointer.</p>
          {expired && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-center text-xs">Votre session a été fermée. Reconnectez-vous.</p>}

          <label className="mt-6 block text-sm font-medium">
            Numéro de téléphone
            <input name="phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 100 20 30" className={input} />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Code personnel
            <input name="password" required type="password" inputMode="numeric" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className={input} />
            <span className="mt-1.5 block text-[0.72rem] font-normal leading-relaxed text-white/65">
              Première connexion : tapez votre numéro de téléphone. Vous choisirez ensuite votre code.
            </span>
          </label>

          {state.choices && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-white/80">Vous enseignez dans plusieurs établissements. Lequel ?</p>
              {state.choices.map((c) => (
                <button key={c.id} type="submit" name="teacherId" value={c.id} className="flex w-full items-center justify-between rounded-xl bg-white/15 px-3 py-2.5 text-left text-sm font-semibold hover:bg-white/25">
                  {c.school} <Icon name="chevronRight" size={16} />
                </button>
              ))}
            </div>
          )}

          {state.error && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-center text-xs font-medium" role="alert">{state.error}</p>}
          {!state.choices && (
            <button type="submit" disabled={pending} className="mt-5 h-12 w-full rounded-xl bg-white text-sm font-bold text-brand-700 transition active:scale-[0.99] disabled:opacity-70">
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          )}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[0.7rem] text-white/60">
            <Icon name="shield" size={13} /> Pointage validé uniquement dans l&apos;enceinte de l&apos;établissement.
          </p>
        </form>
        <p className="mt-6 max-w-xs text-center text-xs text-white/60">Code oublié ? Demandez à la direction de votre école de le réinitialiser.</p>
      </div>
    </div>
  );
}
