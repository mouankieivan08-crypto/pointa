/**
 * Reconnaissance du visage au pointage.
 *
 * Le visage est réduit à une empreinte de 128 nombres (descripteur) : on ne peut pas
 * reconstituer une photo à partir de ces nombres. L'empreinte de référence est calculée
 * une seule fois, à partir de la photo d'inscription prise par la direction.
 *
 * Au pointage, l'empreinte du visage filmé est comparée à celle de référence : plus
 * l'écart est petit, plus c'est la même personne. Les seuils ci-dessous sont ceux
 * recommandés pour ce modèle (0,6 = limite classique) ; ils sont resserrés pour
 * éviter qu'un collègue ressemblant passe à la place de l'enseignant.
 */
export const FACE_MATCH_MAX = 0.48; // en dessous : même personne
export const FACE_DOUBT_MAX = 0.6; // entre les deux : doute, la direction tranche
export const FACE_MODEL_URI = "/models";

/** Taille d'entrée du détecteur : 416 px = bon compromis précision / vitesse sur téléphone. */
export const FACE_INPUT_SIZE = 416;
export const FACE_SCORE_MIN = 0.4;

export type FaceStatus = "verifie" | "doute" | "different" | "non-verifie" | "sans-reference";

export const FACE_LABEL: Record<FaceStatus, string> = {
  verifie: "Visage reconnu",
  doute: "Visage à vérifier",
  different: "Visage différent",
  "non-verifie": "Visage non vérifié",
  "sans-reference": "Pas de photo d'inscription",
};

/** Verdict à partir de l'écart mesuré entre les deux empreintes. */
export function faceVerdict(distance: number | null | undefined): FaceStatus {
  if (distance == null || !Number.isFinite(distance)) return "non-verifie";
  if (distance <= FACE_MATCH_MAX) return "verifie";
  if (distance <= FACE_DOUBT_MAX) return "doute";
  return "different";
}
