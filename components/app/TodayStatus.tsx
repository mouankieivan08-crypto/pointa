import { Badge } from "@/components/ui/Badge";
import type { TeacherToday, TodayStatus } from "@/lib/metrics";

/** Ordre d'affichage : ce qui demande une action d'abord. */
export const STATUS_ORDER: Record<TodayStatus, number> = {
  late: 0,
  absent: 1,
  outside: 2,
  present: 3,
  upcoming: 4,
  leave: 5,
  unscheduled: 6,
};

export function formatHours(h: number): string {
  return `${(Math.round(h * 10) / 10).toLocaleString("fr-FR")} h`;
}

export function StatusBadge({ row }: { row: TeacherToday }) {
  switch (row.status) {
    case "present":
      return <Badge tone="present">Présent</Badge>;
    case "late":
      return <Badge tone="late">Retard · {row.lateMinutes} min</Badge>;
    case "absent":
      return <Badge tone="absent">Absent</Badge>;
    case "outside":
      return <Badge tone="absent">Hors zone · non validé</Badge>;
    case "upcoming":
      return <Badge tone="off">Attendu à {row.firstStart}</Badge>;
    case "leave":
      return <Badge tone="brand">En congé</Badge>;
    default:
      return <Badge tone="off">Hors emploi du temps</Badge>;
  }
}
