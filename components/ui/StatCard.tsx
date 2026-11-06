import { Icon } from "@/components/Icon";

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  tone?: "present" | "late" | "absent" | "off" | "brand";
}) {
  const fg = tone === "brand" ? "var(--brand-600)" : `var(--${tone})`;
  const bg = tone === "brand" ? "var(--brand-50)" : `var(--${tone}-bg)`;
  return (
    <div className="pointa-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          <Icon name={icon} size={20} />
        </span>
      </div>
      {sub && <p className="mt-2 text-xs font-medium" style={{ color: fg }}>{sub}</p>}
    </div>
  );
}
