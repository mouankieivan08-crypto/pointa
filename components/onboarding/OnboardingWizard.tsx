"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { STRUCTURES, STAFF_SIZES, structureOf, type StructureKind } from "@/config/structures";
import { FREE_TIER_MAX_TEACHERS } from "@/config/pricing";
import { saveOnboardingAction, type ActionState } from "@/lib/actions";

/**
 * Mise en route : 4 questions courtes pour adapter Pointa à la structure
 * (école primaire, collège/lycée, université, centre de formation…).
 */
export function OnboardingWizard({ schoolName, firstName }: { schoolName: string; firstName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveOnboardingAction, {});
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<StructureKind | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "loading" | "error">("idle");

  const structure = structureOf(kind);
  const steps = ["Structure", structure.groupMany, "Taille", "Position"];
  const canNext = step === 0 ? !!kind : true;

  function toggle(level: string) {
    setLevels((l) => (l.includes(level) ? l.filter((x) => x !== level) : [...l, level]));
  }
  function addCustom() {
    const v = custom.trim();
    if (v && !levels.includes(v)) setLevels((l) => [...l, v]);
    setCustom("");
  }
  function useMyPosition() {
    if (!("geolocation" in navigator)) return setGeo("error");
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo("idle");
      },
      () => setGeo("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const card = "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition";
  const chip = "rounded-full border px-4 py-2 text-sm font-medium transition";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Logo />
          <span className="text-sm text-muted">Étape {step + 1} / {steps.length}</span>
        </div>
        <div className="h-1 w-full bg-surface-2">
          <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <form action={formAction} className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8">
        <input type="hidden" name="kind" value={kind ?? ""} />
        <input type="hidden" name="levels" value={JSON.stringify(levels)} />
        <input type="hidden" name="staffSize" value={size ?? ""} />
        <input type="hidden" name="lat" value={pos?.lat ?? ""} />
        <input type="hidden" name="lng" value={pos?.lng ?? ""} />

        <div className="flex-1">
          {step === 0 && (
            <Question title={`Bienvenue ${firstName} 👋`} sub={`Deux minutes pour adapter Pointa à ${schoolName}.`} question="Vous dirigez quel type d'établissement ?">
              <div className="grid gap-3 sm:grid-cols-2">
                {STRUCTURES.map((s) => (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => {
                      setKind(s.kind);
                      setLevels(s.levels.slice(0, 6));
                      setStep(1);
                    }}
                    className={`${card} ${kind === s.kind ? "border-brand-500 bg-brand-50" : "border-border bg-surface hover:border-brand-300"}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind === s.kind ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"}`}>
                      <Icon name={s.icon} size={20} />
                    </span>
                    <span>
                      <span className="block font-semibold text-foreground">{s.short}</span>
                      <span className="block text-xs text-muted">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Question>
          )}

          {step === 1 && (
            <Question title={structure.groupQuestion} sub="Touchez celles qui existent chez vous. Vous pourrez en ajouter d'autres plus tard.">
              <div className="flex flex-wrap gap-2">
                {[...new Set([...structure.levels, ...levels])].map((l) => (
                  <button key={l} type="button" onClick={() => toggle(l)} className={`${chip} ${levels.includes(l) ? "border-brand-500 bg-brand-600 text-white" : "border-border bg-surface text-foreground hover:border-brand-300"}`}>
                    {levels.includes(l) && <Icon name="check" size={14} className="mr-1.5 inline" />}
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                  placeholder={`Ajouter : ${structure.example}`}
                  maxLength={40}
                  className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400"
                />
                <button type="button" onClick={addCustom} className="h-11 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-2">
                  Ajouter
                </button>
              </div>
              <p className="mt-3 text-sm text-muted">{levels.length} {levels.length > 1 ? structure.groupMany.toLowerCase() : structure.groupOne} sélectionné(s).</p>
            </Question>
          )}

          {step === 2 && (
            <Question
              title={`Combien ${/^[aeiouyéèê]/i.test(structure.staffOne) ? "d'" : "de "}${structure.staffOne}s environ ?`}
              sub={`L'essai gratuit couvre ${FREE_TIER_MAX_TEACHERS} ${structure.staffOne}s. Au-delà, nous vous proposerons l'offre adaptée.`}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {STAFF_SIZES.map((s) => (
                  <button key={s} type="button" onClick={() => { setSize(s); setStep(3); }} className={`${card} justify-center ${size === s ? "border-brand-500 bg-brand-50" : "border-border bg-surface hover:border-brand-300"}`}>
                    <span className="font-semibold text-foreground">{s}</span>
                  </button>
                ))}
              </div>
            </Question>
          )}

          {step === 3 && (
            <Question title="Où se trouve l'établissement ?" sub="Les pointages ne sont validés que sur place. Si vous êtes dans l'établissement, captez la position maintenant — sinon, vous le ferez plus tard.">
              <button type="button" onClick={useMyPosition} disabled={geo === "loading"} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-70">
                <Icon name="pin" size={18} /> {geo === "loading" ? "Localisation…" : pos ? "Position captée ✓" : "Utiliser ma position actuelle"}
              </button>
              {pos && <p className="mt-3 text-sm font-medium text-present">Position enregistrée (rayon de 100 m autour de l&apos;établissement).</p>}
              {geo === "error" && <p className="mt-3 text-sm text-absent">Position indisponible. Vous pourrez la définir depuis « Localisation » dans le menu.</p>}
            </Question>
          )}
        </div>

        {state.error && <p className="mt-4 rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent" role="alert">{state.error}</p>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-surface-2 disabled:opacity-40">
            Retour
          </button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              Continuer <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button type="submit" disabled={pending || !kind} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              <Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Terminer"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Question({ title, sub, question, children }: { title: string; sub?: string; question?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {sub && <p className="mt-1.5 text-muted">{sub}</p>}
      {question && <p className="mt-6 text-lg font-semibold text-foreground">{question}</p>}
      <div className={question ? "mt-4" : "mt-6"}>{children}</div>
    </div>
  );
}
