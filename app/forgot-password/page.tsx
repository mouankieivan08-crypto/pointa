import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Icon } from "@/components/Icon";
import { SALES_WHATSAPP } from "@/config/pricing";

export default function ForgotPasswordPage() {
  const wa = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent("Bonjour, j'ai oublié le mot de passe du compte Pointa de mon établissement. Nom de l'établissement : ")}`;
  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Nous vous aidons à retrouver l'accès à votre établissement."
      footer={<Link href="/login" className="font-semibold text-brand-600 hover:underline">← Retour à la connexion</Link>}
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          Écrivez au support Pointa sur WhatsApp en indiquant le nom de votre école et l&apos;email du compte. Après vérification, nous vous envoyons un mot de passe temporaire.
        </p>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-present font-semibold text-white hover:opacity-90">
          <Icon name="message" size={18} /> Contacter le support sur WhatsApp
        </a>
        <p className="text-center text-sm text-muted">Ou appelez le +242 06 758 21 84</p>
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted">
          <strong className="text-foreground">Vous êtes enseignant ?</strong> Demandez à la direction de votre école de réinitialiser votre code : vous vous reconnecterez avec votre numéro de téléphone.
        </div>
      </div>
    </AuthShell>
  );
}
