import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { BRAND } from "@/config/brand";
import { FREE_TIER_MAX_TEACHERS } from "@/config/pricing";

/** Mise en page commune aux écrans d'authentification (2 colonnes sur grand écran). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="pointa-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <Link href="/" className="relative"><Logo variant="light" /></Link>
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight">{BRAND.tagline}</h2>
          <p className="mt-4 max-w-sm text-white/80">{BRAND.subtitle}</p>
          <ul className="mt-8 space-y-3">
            {[
              "Pointage depuis le téléphone, dans l'établissement",
              "Retards, absences et paie calculés automatiquement",
              `${FREE_TIER_MAX_TEACHERS} enseignants offerts, sans engagement`,
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-white/90">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15"><Icon name="check" size={14} /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} {BRAND.name}</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden"><Link href="/"><Logo /></Link></div>
          <h1 className="mt-6 text-2xl font-bold text-foreground lg:mt-0">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}

/** Champ de formulaire contrôlé (garde sa valeur si l'envoi échoue). */
export function Field({
  label,
  type = "text",
  placeholder,
  name,
  required = true,
  value,
  onChange,
  autoComplete,
  inputMode,
  hint,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  name: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : {})}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
