import { monthlyQuota } from "@/config/rules";
import type { Employee, Assignment } from "./types";

/** Quota mensuel d'un enseignant (heures) d'après son emploi du temps hebdomadaire. */
export function teacherMonthlyQuota(e: Employee): number {
  return Math.round(monthlyQuota(e.weeklyQuotaHours) * 10) / 10;
}

/** Montant mensuel potentiel d'un créneau si toutes ses heures sont faites. */
export function assignmentMonthly(a: Assignment): number {
  return monthlyQuota(a.hoursPerWeek) * a.hourlyRate;
}
