/**
 * Règles métier centralisées — le "moteur" de Pointa.
 * Retards, déductions, heures sup., score Employé du mois, geofencing.
 * Ces valeurs sont des DÉFAUTS ; chaque entreprise peut les surcharger
 * via ses paramètres (settings) sans toucher au code.
 */

/** Tolérance de retard proposée (minutes). */
export const LATE_TOLERANCE_OPTIONS = [0, 5, 10, 15] as const;
export const DEFAULT_LATE_TOLERANCE = 10;

/** Paliers de déduction par défaut (retard en minutes → montant FCFA). */
export interface DeductionTier {
  minMinutes: number;
  maxMinutes: number | null; // null = et plus
  amount: number; // FCFA
  label: string;
}

export const DEFAULT_DEDUCTION_TIERS: DeductionTier[] = [
  { minMinutes: 0, maxMinutes: 15, amount: 0, label: "0–15 min" },
  { minMinutes: 16, maxMinutes: 30, amount: 250, label: "16–30 min" },
  { minMinutes: 31, maxMinutes: 60, amount: 500, label: "31–60 min" },
  { minMinutes: 61, maxMinutes: 120, amount: 1000, label: "61–120 min" },
  { minMinutes: 121, maxMinutes: null, amount: 2000, label: "+120 min" },
];

/** Calcule le retard en minutes à partir de l'heure prévue et réelle (HH:mm). */
export function computeLateMinutes(
  scheduledStart: string,
  actualArrival: string,
  toleranceMin = DEFAULT_LATE_TOLERANCE,
): number {
  const late = minutesBetween(scheduledStart, actualArrival);
  const effective = late - toleranceMin;
  return effective > 0 ? effective : 0;
}

/** Déduction potentielle pour un retard donné (jamais appliquée sans validation). */
export function computeDeduction(
  lateMinutes: number,
  tiers: DeductionTier[] = DEFAULT_DEDUCTION_TIERS,
): { amount: number; tier: DeductionTier | null } {
  for (const tier of tiers) {
    const underMax = tier.maxMinutes === null || lateMinutes <= tier.maxMinutes;
    if (lateMinutes >= tier.minMinutes && underMax) {
      return { amount: tier.amount, tier };
    }
  }
  return { amount: 0, tier: null };
}

/** Heures supplémentaires : dépassement de l'heure de sortie prévue. */
export function computeOvertimeMinutes(
  scheduledEnd: string,
  actualDeparture: string,
): number {
  const diff = minutesBetween(scheduledEnd, actualDeparture);
  return diff > 0 ? diff : 0;
}

/** Heures travaillées entre arrivée et départ, moins la pause (minutes). */
export function computeWorkedMinutes(
  arrival: string,
  departure: string,
  breakMinutes = 0,
): number {
  const total = minutesBetween(arrival, departure) - breakMinutes;
  return total > 0 ? total : 0;
}

/** Pondérations Enseignant du mois. Somme = 100. */
export const EMPLOYEE_OF_MONTH_WEIGHTS = {
  punctuality: 45, // Ponctualité (arrivées à l'heure)
  presence: 35, // Présence (jours de cours assurés)
  regularity: 20, // Régularité (départs pointés)
  overtime: 0, // Heures supplémentaires : pas encore mesurées
} as const;

export interface ScoreInputs {
  punctualityRate: number; // 0..1
  presenceRate: number; // 0..1
  regularityRate: number; // 0..1
  overtimeRate: number; // 0..1 (normalisé)
}

export function computeEmployeeScore(
  s: ScoreInputs,
  weights = EMPLOYEE_OF_MONTH_WEIGHTS,
): number {
  const score =
    s.punctualityRate * weights.punctuality +
    s.presenceRate * weights.presence +
    s.regularityRate * weights.regularity +
    s.overtimeRate * weights.overtime;
  return Math.round(score);
}

/* ============================================================
   LOGIQUE ÉCOLES — paiement des enseignants à l'heure
   ============================================================ */

/** Semaines facturées par mois (base de calcul du quota mensuel). */
export const WEEKS_PER_MONTH = 4;

/** Quota mensuel (heures) à partir du quota hebdomadaire de l'emploi du temps. */
export function monthlyQuota(weeklyHours: number): number {
  return weeklyHours * WEEKS_PER_MONTH;
}

/** Paie horaire = heures réellement faites × taux horaire (FCFA). */
export function computeHourlyPay(hoursDone: number, hourlyRate: number): number {
  return Math.round(hoursDone * hourlyRate);
}

/** Taux de complétion du quota (0..1). >1 signifie heures supplémentaires. */
export function quotaCompletion(hoursDone: number, quotaHours: number): number {
  if (quotaHours <= 0) return hoursDone > 0 ? 1 : 0;
  return hoursDone / quotaHours;
}

/** État d'un enseignant vis-à-vis de son quota. */
export function quotaStatus(hoursDone: number, quotaHours: number): "sous" | "atteint" | "depasse" {
  const r = quotaCompletion(hoursDone, quotaHours);
  if (r < 0.98) return "sous"; // en-dessous du quota → à surveiller
  if (r > 1.02) return "depasse"; // heures supplémentaires
  return "atteint";
}

/** Méthodes d'identification au pointage (utile quand l'enseignant n'a pas de smartphone). */
export const CLOCKING_METHODS = [
  { id: "photo", label: "Reconnaissance photo", desc: "L'enseignant se présente devant la tablette de l'établissement." },
  { id: "pin", label: "Code PIN", desc: "Secours si la photo échoue — code personnel à 4 chiffres." },
  { id: "manual", label: "Saisie manuelle", desc: "Un responsable enregistre les heures (tracé au journal)." },
] as const;

/** Geofencing : rayon autorisé par défaut (mètres). */
export const DEFAULT_GEOFENCE_RADIUS_M = 100;

export function isWithinGeofence(
  distanceMeters: number,
  radiusMeters = DEFAULT_GEOFENCE_RADIUS_M,
): boolean {
  return distanceMeters <= radiusMeters;
}

/** Distance approximative entre deux points GPS (mètres, formule haversine). */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ---------- helpers internes ---------- */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Différence en minutes entre deux "HH:mm" (b - a). */
export function minutesBetween(a: string, b: string): number {
  return toMinutes(b) - toMinutes(a);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(Math.abs(total) / 60);
  const m = Math.abs(total) % 60;
  const sign = total < 0 ? "-" : "";
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
}
