import Link from "next/link";
import { WEEKDAYS, hhmmToMin, minToHHMM } from "@/lib/time";

export interface GridSlot {
  teacherId: string;
  name: string;
  color: string;
  classe: string;
  day: string;
  start: string;
  end: string;
  conflict?: boolean;
}

const SHORT: Record<string, string> = { Lundi: "Lundi", Mardi: "Mardi", Mercredi: "Mercredi", Jeudi: "Jeudi", Vendredi: "Vendredi", Samedi: "Samedi" };

/**
 * Grille hebdomadaire façon emploi du temps : les heures en colonne, les jours en ligne.
 * Chaque cours est placé à sa vraie position — on voit d'un coup les trous et les chevauchements.
 */
export function WeekGrid({ slots, label }: { slots: GridSlot[]; label: string }) {
  const starts = slots.map((s) => hhmmToMin(s.start) ?? 0);
  const ends = slots.map((s) => hhmmToMin(s.end) ?? 0);
  const from = Math.min(7 * 60, ...(starts.length ? starts : [7 * 60]));
  const to = Math.max(18 * 60, ...(ends.length ? ends : [18 * 60]));
  const dayStart = Math.floor(from / 60) * 60;
  const dayEnd = Math.ceil(to / 60) * 60;
  const span = Math.max(60, dayEnd - dayStart);
  const hours = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => dayStart + i * 60);
  const pxPerHour = 56;
  const height = (span / 60) * pxPerHour;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[46rem]">
        <div className="grid grid-cols-[3.25rem_repeat(6,1fr)]">
          <div />
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b border-l border-border px-2 py-2 text-center text-xs font-semibold text-foreground">
              {SHORT[d] ?? d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.25rem_repeat(6,1fr)]" style={{ height }}>
          {/* Échelle des heures */}
          <div className="relative">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[0.7rem] tabular-nums text-muted"
                style={{ top: `${((h - dayStart) / span) * 100}%` }}
              >
                {minToHHMM(h)}
              </span>
            ))}
          </div>

          {WEEKDAYS.map((day) => {
            const list = slots.filter((s) => s.day === day);
            return (
              <div key={day} className="relative border-l border-border">
                {hours.slice(1, -1).map((h) => (
                  <span key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: `${((h - dayStart) / span) * 100}%` }} />
                ))}
                {list.map((s, i) => {
                  const a = hhmmToMin(s.start) ?? dayStart;
                  const b = hhmmToMin(s.end) ?? a + 60;
                  const overlapping = list.filter((o) => (hhmmToMin(o.start) ?? 0) < b && a < (hhmmToMin(o.end) ?? 0));
                  const rank = overlapping.indexOf(s);
                  const width = 100 / Math.max(1, overlapping.length);
                  return (
                    <Link
                      key={i}
                      href={`/app/employees/${s.teacherId}`}
                      className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-[0.7rem] leading-tight text-white transition hover:brightness-110 ${s.conflict ? "ring-2 ring-absent" : ""}`}
                      style={{
                        top: `${((a - dayStart) / span) * 100}%`,
                        height: `${Math.max(3, ((b - a) / span) * 100)}%`,
                        left: `calc(${rank * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        background: s.color,
                      }}
                      title={`${s.classe} · ${s.start}–${s.end} · ${s.name}`}
                    >
                      <span className="block truncate font-semibold">{s.classe}</span>
                      <span className="block truncate opacity-85">{s.start}–{s.end}</span>
                      <span className="block truncate opacity-75">{s.name}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}
