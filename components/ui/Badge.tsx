import type { ReactNode } from "react";

/**
 * Badge de statut. `tone` correspond à une couleur métier
 * (present/late/absent/off) définie dans le design system.
 */
export function Badge({
  tone = "off",
  children,
  dot = true,
}: {
  tone?: "present" | "late" | "absent" | "off" | "brand";
  children: ReactNode;
  dot?: boolean;
}) {
  const bg = tone === "brand" ? "var(--brand-50)" : `var(--${tone}-bg)`;
  const fg = tone === "brand" ? "var(--brand-700)" : `var(--${tone})`;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />}
      {children}
    </span>
  );
}
