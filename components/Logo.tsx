import { BRAND } from "@/config/brand";

/** Logo Pointa — marque unique réutilisée partout. */
export function Logo({
  size = 28,
  variant = "dark",
  withWordmark = true,
  spin = true,
}: {
  size?: number;
  variant?: "dark" | "light";
  withWordmark?: boolean;
  spin?: boolean;
}) {
  const textColor = variant === "light" ? "text-white" : "text-foreground";
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className="pointa-gradient inline-flex items-center justify-center rounded-xl text-white shadow-sm"
        style={{ width: size + 10, height: size + 10 }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
          {/* aiguille des heures */}
          <line
            className={spin ? "pointa-hand pointa-hand-hour" : undefined}
            x1="12" y1="12" x2="12" y2="8"
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
          />
          {/* aiguille des minutes */}
          <line
            className={spin ? "pointa-hand pointa-hand-min" : undefined}
            x1="12" y1="12" x2="15.4" y2="12"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </span>
      {withWordmark && (
        <span className={`text-[1.35rem] font-bold tracking-tight ${textColor}`}>
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
