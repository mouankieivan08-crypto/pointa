/**
 * Tarification centralisée — écoles. Prix en FCFA / mois.
 * Palier sur le NOMBRE D'ENSEIGNANTS. Ne jamais coder un prix ou une limite en dur ailleurs.
 */
export type PlanId = "essai" | "ecole" | "etablissement" | "reseau";
export type PaidPlanId = Exclude<PlanId, "essai">;

/** Palier gratuit : nombre d'enseignants offerts, sans limite de durée. */
export const FREE_TIER_MAX_TEACHERS = 5;

export const PLAN_NAMES: Record<PlanId, string> = {
  essai: "Essai gratuit",
  ecole: "École",
  etablissement: "Établissement",
  reseau: "Réseau",
};

/** Nombre maximum d'enseignants actifs par plan (modifiable au cas par cas depuis la console). */
export const PLAN_LIMITS: Record<PlanId, number> = {
  essai: FREE_TIER_MAX_TEACHERS,
  ecole: 50,
  etablissement: 100,
  reseau: 300,
};

export interface Plan {
  id: PaidPlanId;
  name: string;
  audience: string;
  priceMonthly: number | null; // null = sur devis
  priceLabel?: string;
  employeesLabel: string;
  highlighted?: boolean;
  cta: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "ecole",
    name: PLAN_NAMES.ecole,
    audience: "Une école",
    priceMonthly: 35000,
    employeesLabel: `Jusqu'à ${PLAN_LIMITS.ecole} enseignants`,
    cta: "Choisir École",
    features: [
      "Pointage depuis le téléphone de l'enseignant",
      "Présence vérifiée dans l'enceinte de l'établissement",
      "Photo de preuve à chaque pointage",
      "Retards, absences et heures calculés automatiquement",
      "Paie horaire, export PDF et Excel",
      "Remplacements, séances supplémentaires et congés",
    ],
  },
  {
    id: "etablissement",
    name: PLAN_NAMES.etablissement,
    audience: "Grand établissement",
    priceMonthly: 50000,
    employeesLabel: `Jusqu'à ${PLAN_LIMITS.etablissement} enseignants`,
    highlighted: true,
    cta: "Choisir Établissement",
    features: [
      "Tout le plan École, plus :",
      `Jusqu'à ${PLAN_LIMITS.etablissement} enseignants`,
      "Accompagnement à la mise en place",
      "Support prioritaire sur WhatsApp",
    ],
  },
  {
    id: "reseau",
    name: PLAN_NAMES.reseau,
    audience: "Plusieurs établissements",
    priceMonthly: null,
    priceLabel: "Sur devis",
    employeesLabel: "Plusieurs établissements",
    cta: "Nous contacter",
    features: [
      "Un compte par établissement",
      "Facturation groupée",
      "Accompagnement dédié",
      "Formation des équipes",
    ],
  },
];

/** Contact commercial (Bongisa) pour activer un abonnement. */
export const SALES_WHATSAPP = "242061135807"; // +242 06 113 58 07
