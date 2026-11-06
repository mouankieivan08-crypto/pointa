/**
 * Identité produit — source unique de vérité.
 * Positionnement : pointage et paie horaire des enseignants des écoles privées.
 * Chaque enseignant pointe depuis SON téléphone, dans l'établissement (position vérifiée au moment
 * du pointage, jamais conservée), avec un code personnel et une photo de preuve.
 */
export const BRAND = {
  name: "Pointa",
  tagline: "Le pointage des heures de vos enseignants.",
  headline: "Valorisez les heures réelles. Payez chaque enseignant au juste prix, sans contestation.",
  subtitle:
    "Chaque enseignant pointe depuis son téléphone, dans l'établissement. Heures, retards, absences et paie horaire sont calculés automatiquement — en toute transparence pour la direction et les enseignants.",
  email: "contact@pointa.app",
  whatsapp: "+242 06 113 58 07",
  phone: "+242 06 758 21 84",
  locale: "fr",
  currency: "FCFA",
  audience: "Écoles, universités et centres de formation",
} as const;

export const CTA = {
  primary: "Créer le compte de mon école",
  secondary: "Voir comment ça marche",
  login: "Connexion",
  signup: "Essai gratuit",
} as const;
