"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { loginAction, type ActionState } from "@/lib/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez au tableau de bord de votre établissement."
      footer={
        <>
          Pas encore de compte ? <Link href="/signup" className="font-semibold text-brand-600 hover:underline">Créer un compte</Link>
          <span className="mt-3 block">Vous êtes enseignant ? <Link href="/espace" className="font-semibold text-brand-600 hover:underline">Espace enseignant</Link></span>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <Field label="Adresse email" name="email" type="email" placeholder="vous@ecole.cg" value={email} onChange={setEmail} autoComplete="email" />
        <div>
          <Field label="Mot de passe" name="password" type="password" placeholder="••••••••" value={password} onChange={setPassword} autoComplete="current-password" />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">Mot de passe oublié ?</Link>
          </div>
        </div>
        {state.error && <p className="rounded-lg bg-absent-bg px-3 py-2 text-sm font-medium text-absent" role="alert">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}
