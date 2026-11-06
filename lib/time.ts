/**
 * Heure locale de l'établissement — Brazzaville = UTC+1 (pas d'heure d'été).
 * Les créneaux (« 08:00 ») et les dates de pointage sont exprimés en heure locale ;
 * le serveur (Vercel) tourne en UTC, d'où ces conversions explicites.
 */
export const TZ_OFFSET_MIN = 60;
export const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
/** Jours de cours proposés dans les emplois du temps. */
export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function shifted(ms: number): Date {
  return new Date(ms + TZ_OFFSET_MIN * 60_000);
}

/** Date locale du jour, "YYYY-MM-DD". */
export function localToday(): string {
  return shifted(Date.now()).toISOString().slice(0, 10);
}

/** Minutes écoulées depuis minuit, heure locale. */
export function localNowMinutes(): number {
  const d = shifted(Date.now());
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function isIsoDate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Jour de la semaine (« Lundi »…) d'une date "YYYY-MM-DD". */
export function weekdayOf(date: string): string {
  return DAYS_FR[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Date locale ("YYYY-MM-DD") d'un horodatage ISO. */
export function localDateOf(iso: string): string {
  return shifted(new Date(iso).getTime()).toISOString().slice(0, 10);
}

/** Minutes depuis minuit (heure locale) d'un horodatage ISO. */
export function localMinutesOf(iso: string): number {
  const d = shifted(new Date(iso).getTime());
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "08:30" → 510 (null si invalide). */
export function hhmmToMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 510 → "08:30". */
export function minToHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Horodatage ISO → "08:30" en heure locale ("—" si vide). */
export function isoToHHMM(iso?: string | null): string {
  return iso ? minToHHMM(localMinutesOf(iso)) : "—";
}

/** Date + heure locales → horodatage ISO (UTC). */
export function localToIso(date: string, hhmm: string): string | null {
  const t = hhmmToMin(hhmm);
  if (!isIsoDate(date) || t == null) return null;
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, t) - TZ_OFFSET_MIN * 60_000).toISOString();
}

/** Majuscule sur la première lettre seulement (« vendredi 11 septembre » → « Vendredi 11 septembre »). */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « vendredi 11 septembre 2026 ». */
export function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** « Ven. 11 sept. ». */
export function shortDate(date: string): string {
  return capitalize(new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }));
}

/** « 11/09/2026 ». */
export function numericDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** « vendredi 11 septembre 2026 » (aujourd'hui, heure locale). */
export function localDateLabel(): string {
  return longDate(localToday());
}

/* ---------------- Mois ---------------- */

/** Mois en cours, "YYYY-MM". */
export function currentMonth(): string {
  return localToday().slice(0, 7);
}

export function isValidMonth(s?: string | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** "2026-09" → « septembre 2026 ». */
export function monthLabelOf(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** « septembre 2026 » (mois en cours). */
export function localMonthLabel(): string {
  return monthLabelOf(currentMonth());
}

/** "2026-09" → "2026-09-30". */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Les `count` derniers mois, du plus récent au plus ancien. */
export function recentMonths(count = 12): string[] {
  const [y, m] = currentMonth().split("-").map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}
