import { formatPhone, whatsappLink } from "./phone";

/** Message WhatsApp pré-rempli qui donne à un enseignant son accès à l'espace de pointage. */
export function inviteLink(opts: { origin: string; schoolName: string; firstName: string; phone: string; hasCode: boolean }): string {
  const url = `${opts.origin}/espace`;
  const text = opts.hasCode
    ? `Bonjour ${opts.firstName}, pour pointer à ${opts.schoolName} : ouvrez ${url} et connectez-vous avec votre numéro (${formatPhone(opts.phone)}) et votre code personnel.`
    : `Bonjour ${opts.firstName}, ${opts.schoolName} utilise Pointa pour le pointage des cours.\n\n1. Ouvrez ${url} sur votre téléphone\n2. Connectez-vous avec votre numéro (${formatPhone(opts.phone)}) — pour la première connexion, le mot de passe est aussi votre numéro\n3. Choisissez votre code personnel\n\nEnsuite, pointez votre arrivée et votre départ depuis l'établissement. Votre relevé d'heures est visible dans votre espace.`;
  return whatsappLink(opts.phone, text);
}
