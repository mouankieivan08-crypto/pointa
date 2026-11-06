"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { signupAction, type ActionState } from "@/lib/actions";
import { FREE_TIER_MAX_TEACHERS } from "@/config/pricing";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signupAction, {});
  const [v, setV] = useState({ company: "", name: "", email: "", phone: "", city: "", password: "" });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <AuthShell
      title="Créer le compte de votre établissement"
      subtitle={`${FREE_TIER_MAX_TEACHERS} enseignants offerts · sans engagement · sans carte bancaire`}
      footer={<>Déjà un compte ? <Link href="/login" className="font-semibold text-brand-600 hover:underline">Se connecter</Link></>}
    >
      <form action={formAction} className="space-y-4">
        {/* Champ piège pour les robots (invisible pour les humains) */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <Field label="Nom de l'établissement" name="company" placeholder="Complexe Scolaire La Réussite" value={v.company} onChange={set("company")} autoComplete="organization" />
        <Field label="Votre nom complet" name="name" placeholder="Marc Kimbouala" value={v.name} onChange={set("name")} autoComplete="name" />
        <Field label="Adresse email" name="email" type="email" placeholder="vous@ecole.cg" value={v.email} onChange={set("email")} autoComplete="email" />
        <Field label="Téléphone (WhatsApp)" name="phone" type="tel" inputMode="tel" placeholder="06 100 20 30" value={v.phone} onChange={set("phone")} required={false} autoComplete="tel" hint="Pour vous aider à démarrer et activer votre abonnement." />
        <Field label="Ville / quartier" name="city" placeholder="Brazzaville, Ouenzé" value={v.city} onChange={set("city")} required={false} />
        <Field label="Mot de passe" name="password" type="password" placeholder="8 caractères minimum" value={v.password} onChange={set("password")} autoComplete="new-password" />
        {state.error && <p className="rounded-lg bg-absent-bg px-3 py-2 text-sm font-medium text-absent" role="alert">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
        <p className="text-center text-xs text-muted">Vos données restent privées : chaque établissement ne voit que les siennes.</p>
      </form>
    </AuthShell>
  );
}
