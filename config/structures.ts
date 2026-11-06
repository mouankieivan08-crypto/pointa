/**
 * Types de structures — Pointa s'adapte au vocabulaire de l'établissement.
 * Une université parle de « promotions » et de « Licence 1 », une école primaire de
 * « classes » et de « CM2 », un centre de formation de « groupes » et de « formateurs ».
 */
export type StructureKind = "primaire" | "college_lycee" | "complexe" | "superieur" | "formation" | "autre";

export interface Structure {
  kind: StructureKind;
  /** Libellé complet (enregistré comme « type » de l'établissement). */
  label: string;
  /** Libellé court pour les cartes de choix. */
  short: string;
  hint: string;
  icon: string;
  staffOne: string; // « enseignant », « formateur »…
  staffMany: string; // « Enseignants »
  groupOne: string; // « classe », « promotion », « groupe »
  groupMany: string; // « Classes »
  /** Question posée à l'inscription. */
  groupQuestion: string;
  /** Niveaux proposés par défaut. */
  levels: string[];
  /** Exemple de saisie (placeholder). */
  example: string;
}

export const STRUCTURES: Structure[] = [
  {
    kind: "primaire",
    label: "École primaire",
    short: "École primaire",
    hint: "Du CP au CM2",
    icon: "users",
    staffOne: "enseignant",
    staffMany: "Enseignants",
    groupOne: "classe",
    groupMany: "Classes",
    groupQuestion: "Quelles classes avez-vous ?",
    levels: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
    example: "CM2 A",
  },
  {
    kind: "college_lycee",
    label: "Collège / Lycée",
    short: "Collège / Lycée",
    hint: "De la 6e à la Terminale",
    icon: "calendar",
    staffOne: "enseignant",
    staffMany: "Enseignants",
    groupOne: "classe",
    groupMany: "Classes",
    groupQuestion: "Quelles classes avez-vous ?",
    levels: ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"],
    example: "6e A",
  },
  {
    kind: "complexe",
    label: "Complexe scolaire",
    short: "Complexe scolaire",
    hint: "Primaire, collège et lycée réunis",
    icon: "globe",
    staffOne: "enseignant",
    staffMany: "Enseignants",
    groupOne: "classe",
    groupMany: "Classes",
    groupQuestion: "Quelles classes avez-vous ?",
    levels: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2", "6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"],
    example: "5e B",
  },
  {
    kind: "superieur",
    label: "Université / Institut supérieur",
    short: "Université",
    hint: "Licence, master, filières",
    icon: "trophy",
    staffOne: "enseignant",
    staffMany: "Enseignants",
    groupOne: "promotion",
    groupMany: "Promotions",
    groupQuestion: "Quelles promotions avez-vous ?",
    levels: ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"],
    example: "Licence 2 Droit",
  },
  {
    kind: "formation",
    label: "Centre de formation / institut",
    short: "Centre de formation",
    hint: "Informatique, beauté, langues, métiers",
    icon: "lightning",
    staffOne: "formateur",
    staffMany: "Formateurs",
    groupOne: "groupe",
    groupMany: "Groupes",
    groupQuestion: "Quels groupes ou sessions avez-vous ?",
    levels: ["Groupe A", "Groupe B", "Session du matin", "Session du soir"],
    example: "Groupe A",
  },
  {
    kind: "autre",
    label: "Autre structure",
    short: "Autre",
    hint: "Cours du soir, association, atelier…",
    icon: "plus",
    staffOne: "intervenant",
    staffMany: "Intervenants",
    groupOne: "groupe",
    groupMany: "Groupes",
    groupQuestion: "Quels groupes avez-vous ?",
    levels: ["Groupe 1", "Groupe 2"],
    example: "Groupe 1",
  },
];

export const DEFAULT_STRUCTURE = STRUCTURES[2];

export function structureOf(kind?: string | null): Structure {
  return STRUCTURES.find((s) => s.kind === kind) ?? DEFAULT_STRUCTURE;
}

/** Tailles proposées (sert à conseiller l'offre adaptée). */
export const STAFF_SIZES = ["1 à 5", "6 à 20", "21 à 50", "Plus de 50"] as const;
