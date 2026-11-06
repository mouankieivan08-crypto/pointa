import { BRAND } from "./brand";

/**
 * Formatage monétaire centralisé (FCFA, séparateur d'espace).
 * Utilisé partout : paie, déductions, pricing.
 */
export function formatMoney(amount: number, withCurrency = true): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return withCurrency ? `${formatted} ${BRAND.currency}` : formatted;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
