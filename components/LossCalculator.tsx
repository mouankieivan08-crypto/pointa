"use client";

import { useState } from "react";
import { formatMoney } from "@/config/money";
import { Icon } from "@/components/Icon";

/**
 * Calculateur de perte — outil de conversion de la landing.
 * Montre concrètement ce qu'une école perd quand un enseignant manque des
 * heures qu'elle paie. Année scolaire = 10 mois, mois = 4 semaines.
 */
const WEEKS_PER_MONTH = 4;
const MONTHS_PER_YEAR = 10;

export function LossCalculator() {
  const [rate, setRate] = useState(3000); // FCFA / heure
  const [missedHours, setMissedHours] = useState(1); // heures manquées / semaine
  const [teachers, setTeachers] = useState(1); // enseignants concernés

  const perWeek = rate * missedHours * teachers;
  const perMonth = perWeek * WEEKS_PER_MONTH;
  const perYear = perMonth * MONTHS_PER_YEAR;

  return (
    <div className="pointa-card overflow-hidden">
      <div className="grid md:grid-cols-2">
        {/* Réglages */}
        <div className="space-y-6 p-6 sm:p-8">
          <NumberField
            label="Taux horaire payé"
            suffix="FCFA / heure"
            value={rate}
            step={500}
            min={500}
            onChange={setRate}
          />
          <SliderField
            label="Heures manquées par semaine"
            hint="retards, absences, cours écourtés"
            value={missedHours}
            min={1}
            max={10}
            suffix={missedHours > 1 ? "heures" : "heure"}
            onChange={setMissedHours}
          />
          <SliderField
            label="Enseignants concernés"
            value={teachers}
            min={1}
            max={30}
            suffix={teachers > 1 ? "enseignants" : "enseignant"}
            onChange={setTeachers}
          />
        </div>

        {/* Résultat */}
        <div className="relative flex flex-col justify-center gap-1 border-t border-border bg-absent-bg p-6 sm:p-8 md:border-l md:border-t-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-absent">Ce que vous perdez</p>
          <p className="mt-2 text-4xl font-extrabold text-absent sm:text-5xl">{formatMoney(perYear, false)}</p>
          <p className="text-sm font-medium text-absent/80">FCFA par année scolaire (10 mois)</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Sub label="Par semaine" value={formatMoney(perWeek)} />
            <Sub label="Par mois" value={formatMoney(perMonth)} />
          </div>

          <p className="mt-6 flex items-start gap-2 text-sm text-foreground">
            <Icon name="check" size={17} className="mt-0.5 shrink-0 text-present" />
            Avec Pointa, ces heures sont pointées et prouvées — vous ne payez que le réel.
          </p>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, suffix, value, step, min, onChange }: { label: string; suffix: string; value: number; step: number; min: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - step))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-surface-2" aria-label="Diminuer">−</button>
        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            step={step}
            min={min}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-3 pr-24 text-lg font-bold text-foreground outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>
        </div>
        <button onClick={() => onChange(value + step)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground hover:bg-surface-2" aria-label="Augmenter">+</button>
      </div>
    </div>
  );
}

function SliderField({ label, hint, value, min, max, suffix, onChange }: { label: string; hint?: string; value: number; min: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        <span className="text-sm font-bold text-brand-600">{value} {suffix}</span>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-brand-600"
      />
    </div>
  );
}

function Sub({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}
