"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/form-client";
import {
  consoleLoginAction,
  activatePlanAction,
  resetAdminPasswordAction,
  deleteSchoolAction,
  sendNoticeAction,
  setOwnerPasswordAction,
  type ConsoleState,
} from "@/lib/console-actions";

const field = "h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-slate-500";
const btn = "h-10 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-60";

function Feedback({ state }: { state: ConsoleState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-400" role="alert">{state.error}</p>;
  if (state.ok) return <p className="mt-2 break-words text-xs text-emerald-400" role="status">{state.ok}</p>;
  return null;
}

export function ConsoleLogin() {
  const { state, pending, submit } = useActionForm(consoleLoginAction);
  const [mode, setMode] = useState<"email" | "key">("email");
  const [v, setV] = useState({ email: "", password: "", key: "" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <form onSubmit={submit()} className="w-full max-w-sm">
        <p className="text-center text-lg font-bold">Pointa · Console</p>
        <p className="mt-1 text-center text-xs text-slate-500">Espace plateforme — accès restreint</p>

        {mode === "email" ? (
          <div className="mt-6 space-y-3">
            <input
              autoFocus
              type="email"
              name="email"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
              placeholder="Votre email"
              autoComplete="username"
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
            />
            <input
              type="password"
              name="password"
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              placeholder="Mot de passe"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
            />
          </div>
        ) : (
          <input
            autoFocus
            type="password"
            name="key"
            value={v.key}
            onChange={(e) => setV({ ...v, key: e.target.value })}
            placeholder="Clé d'accès"
            autoComplete="off"
            className="mt-6 h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-center text-sm tracking-widest text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
          />
        )}

        {state.error && <p className="mt-2 text-center text-xs text-red-400">{state.error}</p>}
        <button type="submit" disabled={pending} className="mt-3 h-12 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-60">
          {pending ? "Vérification…" : "Entrer"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "email" ? "key" : "email")}
          className="mt-4 w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
        >
          {mode === "email" ? "Utiliser la clé d'accès" : "Utiliser mon email"}
        </button>
      </form>
    </div>
  );
}

export function ActivatePlanForm({ schoolId, currentPlan }: { schoolId: string; currentPlan: string }) {
  const { state, pending, submit } = useActionForm(activatePlanAction);
  const [plan, setPlan] = useState(currentPlan === "essai" ? "ecole" : currentPlan);
  const [months, setMonths] = useState("1");
  const [limit, setLimit] = useState("");
  return (
    <form onSubmit={submit()}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="flex flex-wrap gap-2">
        <select name="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={field}>
          <option value="ecole">École (50)</option>
          <option value="etablissement">Établissement (100)</option>
          <option value="reseau">Réseau (300)</option>
          <option value="essai">Résilier → essai gratuit</option>
        </select>
        {plan !== "essai" && (
          <>
            <select name="months" value={months} onChange={(e) => setMonths(e.target.value)} className={field}>
              {[1, 3, 6, 10, 12, 24].map((m) => <option key={m} value={m}>{m} mois</option>)}
            </select>
            <input name="limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Limite (option)" className={`${field} w-32`} />
          </>
        )}
        <button type="submit" disabled={pending} className={`${btn} ${plan === "essai" ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-indigo-500 text-white hover:bg-indigo-400"}`}>
          {pending ? "…" : plan === "essai" ? "Résilier" : "Activer / prolonger"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ResetAdminForm({ schoolId, admins }: { schoolId: string; admins: { id: string; email: string }[] }) {
  const { state, pending, submit } = useActionForm(resetAdminPasswordAction);
  const [userId, setUserId] = useState(admins[0]?.id ?? "");
  if (!admins.length) return <p className="text-xs text-slate-500">Aucun compte direction.</p>;
  return (
    <form onSubmit={submit()}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="flex flex-wrap gap-2">
        <select name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className={`${field} max-w-[16rem]`}>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
        <button type="submit" disabled={pending} className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`}>
          {pending ? "…" : "Nouveau mot de passe"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function NoticeForm({ schoolId }: { schoolId: string }) {
  const { state, pending, submit } = useActionForm(sendNoticeAction);
  const [v, setV] = useState({ title: "", body: "" });
  return (
    <form onSubmit={submit()}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="space-y-2">
        <input name="title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Titre (ex : Abonnement bientôt échu)" className={`${field} w-full`} required />
        <textarea
          name="body"
          value={v.body}
          onChange={(e) => setV({ ...v, body: e.target.value })}
          placeholder="Message visible dans les notifications de la direction"
          rows={2}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 outline-none focus:border-slate-500"
          required
        />
        <button type="submit" disabled={pending} className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`}>
          {pending ? "…" : "Envoyer à la direction"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteSchoolForm({ schoolId, name }: { schoolId: string; name: string }) {
  const { state, pending, submit } = useActionForm(deleteSchoolAction);
  const [confirm, setConfirm] = useState("");
  return (
    <form onSubmit={submit()}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="flex flex-wrap gap-2">
        <input name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Tapez « ${name} »`} autoComplete="off" className={`${field} w-56`} />
        <button type="submit" disabled={pending || confirm.trim() !== name} className={`${btn} bg-red-600 text-white hover:bg-red-500`}>
          {pending ? "…" : "Supprimer"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function OwnerPasswordForm({ emails }: { emails: string[] }) {
  const { state, pending, submit } = useActionForm(setOwnerPasswordAction);
  const [v, setV] = useState({ email: emails[0] ?? "", password: "" });
  return (
    <form onSubmit={submit()}>
      <div className="flex flex-wrap gap-2">
        <select name="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={`${field} max-w-[18rem]`}>
          {emails.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          type="password"
          name="password"
          value={v.password}
          onChange={(e) => setV({ ...v, password: e.target.value })}
          placeholder="Nouveau mot de passe (8 car. min)"
          autoComplete="new-password"
          className={`${field} w-64`}
          required
        />
        <button type="submit" disabled={pending} className={`${btn} bg-indigo-500 text-white hover:bg-indigo-400`}>
          {pending ? "…" : "Définir"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
