import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

const STYLES = {
  info: "border-brand-100 bg-brand-50 text-brand-700",
  ok: "border-present/20 bg-present-bg text-present",
  warn: "border-late/30 bg-late-bg text-late",
  error: "border-absent/20 bg-absent-bg text-absent",
} as const;

const ICONS = { info: "info", ok: "check", warn: "alert", error: "alert" } as const;

/** Bandeau d'information (succès, avertissement, erreur) avec action facultative. */
export function Notice({ tone = "info", children, action }: { tone?: keyof typeof STYLES; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${STYLES[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <span className="flex items-start gap-2">
        <Icon name={ICONS[tone]} size={18} className="mt-0.5 shrink-0" />
        <span>{children}</span>
      </span>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
