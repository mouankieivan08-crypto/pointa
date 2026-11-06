/**
 * Numéros de téléphone : une seule forme stockée (« +242061002030 »), quel que soit
 * le format saisi (« 06 100 20 30 », « +242 06 100 20 30 », « 00242 06… »).
 * Congo-Brazzaville (+242) par défaut pour les numéros locaux à 9 chiffres.
 */
export function normalizePhone(input: string): string {
  const raw = (input || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("00")) digits = digits.slice(2);
  else if (!raw.startsWith("+") && digits.length === 9 && digits.startsWith("0")) digits = `242${digits}`;
  return `+${digits}`;
}

/** Numéro plausible une fois normalisé (8 à 15 chiffres). */
export function isValidPhone(normalized: string): boolean {
  return /^\+\d{8,15}$/.test(normalized);
}

/** Affichage lisible : +242061002030 → « +242 06 100 20 30 ». */
export function formatPhone(value?: string | null): string {
  if (!value) return "";
  const n = normalizePhone(value);
  const m = /^\+242(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(n);
  return m ? `+242 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : value;
}

/** Lien WhatsApp (wa.me) vers ce numéro, avec un message pré-rempli. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${normalizePhone(phone).replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}
