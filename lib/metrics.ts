import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { DEFAULT_LATE_TOLERANCE } from "@/config/rules";
import {
  localToday,
  localNowMinutes,
  weekdayOf,
  localMinutesOf,
  hhmmToMin,
  minToHHMM,
  currentMonth,
  isValidMonth,
  lastDayOfMonth,
  monthLabelOf,
  isIsoDate,
  addDays,
} from "./time";

/**
 * Indicateurs RÉELS, calculés à partir des pointages, de l'emploi du temps et des congés.
 * - Créneaux du jour : emploi du temps hebdomadaire + séances ponctuelles
 *   (remplacements, heures supplémentaires) prévues à cette date.
 * - Heures vérifiées : recouvrement entre [arrivée, départ] et les créneaux du jour,
 *   uniquement pour les pointages validés dans l'établissement, départ pointé.
 * - Retard : arrivée après le début du 1er créneau du jour + tolérance de l'établissement.
 * - Absence : jour avec au moins un créneau, sans arrivée et sans congé accepté.
 * - Paie : heures vérifiées × taux horaire du créneau concerné.
 *   Un retard réduit donc les heures comptées ; une absence n'est pas payée.
 */

interface Slot {
  start: number;
  end: number;
  rate: number;
}
interface AssignRow {
  teacher_id: string;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate: number;
}
interface AttRow {
  id: string;
  teacher_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  within_geofence: boolean;
}
interface LeaveRange {
  teacher_id: string;
  start_date: string;
  end_date: string;
}

export type TodayStatus = "present" | "late" | "absent" | "upcoming" | "outside" | "leave" | "unscheduled";

export interface TeacherToday {
  teacherId: string;
  status: TodayStatus;
  checkIn: string | null;
  checkOut: string | null;
  firstStart: string | null;
  lateMinutes: number;
  hours: number;
  attendanceId: string | null;
}

export interface TeacherMonth {
  plannedHours: number;
  plannedPay: number;
  verifiedHours: number;
  pay: number;
  presentDays: number;
  lateCount: number;
  lateMinutes: number;
  absences: number;
  leaveDays: number;
  outsideDays: number;
  missingDepartures: number;
  /** Détail des anomalies du mois (rapport mensuel). */
  events: { date: string; kind: "late" | "absent" | "outside" | "missing"; minutes?: number }[];
}

export interface SchoolMetrics {
  monthKey: string;
  isCurrentMonth: boolean;
  /** Jour détaillé : aujourd'hui (mois en cours) ou le jour demandé. */
  dayKey: string | null;
  today: { expected: number; present: number; late: number; absent: number; outside: number; onLeave: number; hours: number; rows: TeacherToday[] };
  month: { label: string; verifiedHours: number; pay: number; plannedPay: number; lateCount: number; absences: number; byTeacher: Record<string, TeacherMonth> };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function emptyMonth(): TeacherMonth {
  return { plannedHours: 0, plannedPay: 0, verifiedHours: 0, pay: 0, presentDays: 0, lateCount: 0, lateMinutes: 0, absences: 0, leaveDays: 0, outsideDays: 0, missingDepartures: 0, events: [] };
}

/** Index des créneaux : hebdomadaires (clé « teacher|Lundi ») et ponctuels (clé « teacher|2026-09-14 »). */
function slotIndex(rows: AssignRow[]) {
  const map = new Map<string, Slot[]>();
  for (const a of rows) {
    const s = hhmmToMin(a.start_time);
    const e = hhmmToMin(a.end_time);
    if (!a.day || s == null || e == null || e <= s) continue;
    const k = `${a.teacher_id}|${a.day}`;
    const list = map.get(k) ?? [];
    list.push({ start: s, end: e, rate: Number(a.hourly_rate) || 0 });
    map.set(k, list);
  }
  return (teacherId: string, date: string): Slot[] => [...(map.get(`${teacherId}|${weekdayOf(date)}`) ?? []), ...(map.get(`${teacherId}|${date}`) ?? [])];
}

export async function schoolMetrics(
  schoolId: string,
  teacherIds: string[],
  opts: { month?: string; day?: string; tolerance?: number } = {},
): Promise<SchoolMetrics> {
  const today = localToday();
  const nowMin = localNowMinutes();
  const cur = currentMonth();
  const day = opts.day && isIsoDate(opts.day) && opts.day <= today ? opts.day : null;
  const monthKey = day ? day.slice(0, 7) : isValidMonth(opts.month) && opts.month <= cur ? opts.month : cur;
  const isCurrentMonth = monthKey === cur;
  const focus = day ?? (isCurrentMonth ? today : null);
  const from = `${monthKey}-01`;
  const to = isCurrentMonth ? today : lastDayOfMonth(monthKey);
  const tol = opts.tolerance ?? DEFAULT_LATE_TOLERANCE;

  const result: SchoolMetrics = {
    monthKey,
    isCurrentMonth,
    dayKey: focus,
    today: { expected: 0, present: 0, late: 0, absent: 0, outside: 0, onLeave: 0, hours: 0, rows: [] },
    month: { label: monthLabelOf(monthKey), verifiedHours: 0, pay: 0, plannedPay: 0, lateCount: 0, absences: 0, byTeacher: {} },
  };
  if (!teacherIds.length) return result;

  const sb = supabaseAdmin();
  const [{ data: aData }, { data: attData }, { data: lvData }, { data: tData }] = await Promise.all([
    sb.from("class_assignments").select("teacher_id,day,start_time,end_time,hourly_rate").in("teacher_id", teacherIds),
    sb
      .from("attendance")
      .select("id,teacher_id,date,check_in,check_out,within_geofence")
      .eq("school_id", schoolId)
      .gte("date", from)
      .lte("date", to)
      .limit(10000),
    sb
      .from("leaves")
      .select("teacher_id,start_date,end_date")
      .eq("school_id", schoolId)
      .eq("status", "accepted")
      .lte("start_date", to)
      .gte("end_date", from),
    sb.from("teachers").select("id,hire_date,created_at").in("id", teacherIds),
  ]);

  // Un enseignant n'est pas « absent » avant son arrivée dans l'établissement.
  const startedOn = new Map<string, string>();
  for (const t of (tData as { id: string; hire_date: string | null; created_at: string }[] | null) ?? []) {
    startedOn.set(t.id, (t.hire_date ?? t.created_at ?? "").slice(0, 10));
  }

  const slotsFor = slotIndex((aData as AssignRow[] | null) ?? []);

  // Jours couverts par un congé accepté
  const onLeave = new Set<string>();
  for (const l of (lvData as LeaveRange[] | null) ?? []) {
    for (let d = l.start_date < from ? from : l.start_date; d <= l.end_date && d <= to; d = addDays(d, 1)) onLeave.add(`${l.teacher_id}|${d}`);
  }

  // Pointages indexés par enseignant + date (fusion défensive si plusieurs lignes)
  const att = new Map<string, AttRow>();
  for (const r of (attData as AttRow[] | null) ?? []) {
    const k = `${r.teacher_id}|${r.date}`;
    const prev = att.get(k);
    if (!prev) {
      att.set(k, { ...r });
      continue;
    }
    if (r.check_in && (!prev.check_in || r.check_in < prev.check_in)) prev.check_in = r.check_in;
    if (r.check_out && (!prev.check_out || r.check_out > prev.check_out)) prev.check_out = r.check_out;
    prev.within_geofence = prev.within_geofence && r.within_geofence;
  }

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);

  const t = result.today;
  for (const tid of teacherIds) {
    const m = emptyMonth();
    const since = startedOn.get(tid) ?? "";
    for (const date of dates) {
      if (since && date < since) continue; // avant son arrivée
      const isToday = date === today;
      const isFocus = date === focus;
      const daySlots = slotsFor(tid, date);
      const a = att.get(`${tid}|${date}`);
      const ci = a?.check_in ? localMinutesOf(a.check_in) : null;
      const co = a?.check_out ? localMinutesOf(a.check_out) : null;
      const base = { teacherId: tid, checkIn: ci != null ? minToHHMM(ci) : null, checkOut: co != null ? minToHHMM(co) : null, attendanceId: a?.id ?? null };

      if (!daySlots.length) {
        if (isFocus && (ci != null || co != null)) t.rows.push({ ...base, status: "unscheduled", firstStart: null, lateMinutes: 0, hours: 0 });
        continue;
      }

      const firstStart = Math.min(...daySlots.map((s) => s.start));
      const lastEnd = Math.max(...daySlots.map((s) => s.end));

      // Congé accepté (et pas venu) : ni absence, ni heures prévues.
      if (ci == null && onLeave.has(`${tid}|${date}`)) {
        m.leaveDays++;
        if (isFocus) {
          t.onLeave++;
          t.rows.push({ ...base, status: "leave", firstStart: minToHHMM(firstStart), lateMinutes: 0, hours: 0 });
        }
        continue;
      }

      // Prévu à ce jour : pour aujourd'hui, seulement le temps de cours déjà écoulé
      for (const s of daySlots) {
        const planned = isToday ? overlap(s.start, s.end, 0, nowMin) : s.end - s.start;
        m.plannedHours += planned / 60;
        m.plannedPay += (planned / 60) * s.rate;
      }

      let status: TodayStatus;
      let lateMin = 0;
      let hours = 0;

      if (ci == null) {
        const due = !isToday || nowMin > firstStart + tol;
        status = due ? "absent" : "upcoming";
        if (due) {
          m.absences++;
          m.events.push({ date, kind: "absent" });
        }
      } else {
        m.presentDays++;
        const late = ci - firstStart;
        if (late > tol) {
          lateMin = late;
          m.lateCount++;
          m.lateMinutes += late;
          m.events.push({ date, kind: "late", minutes: late });
        }
        if (!a!.within_geofence) {
          status = "outside"; // pointage hors de l'établissement : non validé, non payé
          m.outsideDays++;
          m.events.push({ date, kind: "outside" });
        } else {
          status = lateMin > 0 ? "late" : "present";
          const end = co ?? (isToday ? Math.min(nowMin, lastEnd) : null);
          if (end != null) {
            for (const s of daySlots) {
              const ov = overlap(ci, end, s.start, s.end);
              hours += ov / 60;
              if (co != null) {
                m.verifiedHours += ov / 60;
                m.pay += (ov / 60) * s.rate;
              }
            }
          }
          if (co == null && (!isToday || nowMin > lastEnd)) {
            m.missingDepartures++;
            m.events.push({ date, kind: "missing" });
          }
        }
      }

      if (isFocus) {
        t.expected++;
        t.rows.push({ ...base, status, firstStart: minToHHMM(firstStart), lateMinutes: lateMin, hours: round1(hours) });
        if (status === "present" || status === "late") {
          t.present++;
          t.hours += hours;
        }
        if (status === "late") t.late++;
        if (status === "absent") t.absent++;
        if (status === "outside") t.outside++;
      }
    }

    m.plannedHours = round1(m.plannedHours);
    m.verifiedHours = round1(m.verifiedHours);
    m.pay = Math.round(m.pay);
    m.plannedPay = Math.round(m.plannedPay);
    result.month.byTeacher[tid] = m;
    result.month.verifiedHours += m.verifiedHours;
    result.month.pay += m.pay;
    result.month.plannedPay += m.plannedPay;
    result.month.lateCount += m.lateCount;
    result.month.absences += m.absences;
  }

  t.hours = round1(t.hours);
  result.month.verifiedHours = round1(result.month.verifiedHours);
  return result;
}

/** Cours d'un enseignant pour une date (emploi du temps + séances ponctuelles). */
export async function teacherDaySchedule(teacherId: string, date = localToday()): Promise<{ classe: string; start: string; end: string; oneOff: boolean }[]> {
  const { data } = await supabaseAdmin()
    .from("class_assignments")
    .select("classe,day,start_time,end_time")
    .eq("teacher_id", teacherId)
    .in("day", [weekdayOf(date), date]);
  return ((data as { classe: string; day: string; start_time: string | null; end_time: string | null }[] | null) ?? [])
    .filter((r) => hhmmToMin(r.start_time) != null && hhmmToMin(r.end_time) != null)
    .map((r) => ({ classe: r.classe, start: r.start_time!, end: r.end_time!, oneOff: isIsoDate(r.day) }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Retard à l'arrivée (minutes, 0 si à l'heure) par rapport au 1er cours du jour.
 * `when` sert aux pointages hors ligne : le retard se calcule à l'heure réelle
 * du pointage, pas à l'heure où le téléphone a retrouvé du réseau.
 */
export async function arrivalLateness(
  teacherId: string,
  tolerance = DEFAULT_LATE_TOLERANCE,
  when?: { date: string; minutes: number },
): Promise<number> {
  const slots = await teacherDaySchedule(teacherId, when?.date);
  if (!slots.length) return 0;
  const first = Math.min(...slots.map((s) => hhmmToMin(s.start)!));
  const late = (when?.minutes ?? localNowMinutes()) - first;
  return late > tolerance ? late : 0;
}
