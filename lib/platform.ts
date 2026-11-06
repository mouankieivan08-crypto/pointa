import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { listAllSchools, teacherCountsBySchool, lastAttendanceBySchool, type School } from "./db";
import { getAllSchoolPlans, type SchoolPlan } from "./plan";
import { listSchoolAdmins } from "./auth";
import { localToday, addDays, currentMonth } from "./time";
import { PLANS, PLAN_LIMITS, type PlanId } from "@/config/pricing";

/**
 * Vue plateforme (console Pointa) : tout ce qui concerne l'ensemble des
 * établissements clients. Jamais utilisé depuis l'espace d'un établissement.
 */

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  lastSignIn: string | null;
}

export interface SchoolRow {
  school: School;
  plan: SchoolPlan;
  teachers: number;
  maxTeachers: number;
  lastAttendance: string | null;
  admins: AdminAccount[];
  /** Jours restants avant échéance (null = sans échéance). */
  daysLeft: number | null;
  /** Revenu mensuel que rapporte cet établissement. */
  monthly: number;
  active: boolean;
}

const PRICE = new Map<string, number>(PLANS.map((p) => [p.id, p.priceMonthly ?? 0]));

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export async function listSchoolRows(): Promise<SchoolRow[]> {
  const [schools, counts, plans, admins] = await Promise.all([
    listAllSchools(),
    teacherCountsBySchool(),
    getAllSchoolPlans(),
    listSchoolAdmins(),
  ]);
  const last = await lastAttendanceBySchool(schools.map((s) => s.id));
  const today = localToday();
  const since = addDays(today, -21);

  return schools.map((school) => {
    const plan = plans.get(school.id) ?? { id: "essai" as PlanId, name: "Essai gratuit", maxTeachers: PLAN_LIMITS.essai, until: null, paid: false, expired: false };
    const lastAtt = last.get(school.id) ?? null;
    return {
      school,
      plan,
      teachers: counts.get(school.id) ?? 0,
      maxTeachers: plan.maxTeachers,
      lastAttendance: lastAtt,
      admins: admins.get(school.id) ?? [],
      daysLeft: plan.until ? daysBetween(today, plan.until) : null,
      monthly: plan.paid ? PRICE.get(plan.id) ?? 0 : 0,
      active: !!lastAtt && lastAtt >= since,
    };
  });
}

export interface PlatformStats {
  schools: number;
  schoolsActive: number;
  teachers: number;
  adminAccounts: number;
  paying: number;
  trial: number;
  expired: number;
  mrr: number;
  arr: number;
  punchesToday: number;
  punchesMonth: number;
  /** Inscriptions d'établissements par mois (12 derniers). */
  signups: { month: string; count: number }[];
  /** Abonnements qui arrivent à échéance dans les 30 jours. */
  expiring: SchoolRow[];
  conversion: number;
}

export async function platformStats(rows: SchoolRow[]): Promise<PlatformStats> {
  const sb = supabaseAdmin();
  const today = localToday();
  const month = currentMonth();
  const [{ count: punchesToday }, { count: punchesMonth }] = await Promise.all([
    sb.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
    sb.from("attendance").select("id", { count: "exact", head: true }).gte("date", `${month}-01`),
  ]);

  const byMonth = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i, 1);
    byMonth.set(d.toISOString().slice(0, 7), 0);
  }
  for (const r of rows) {
    const m = r.school.created_at.slice(0, 7);
    if (byMonth.has(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }

  const paying = rows.filter((r) => r.plan.paid);
  const mrr = paying.reduce((s, r) => s + r.monthly, 0);

  return {
    schools: rows.length,
    schoolsActive: rows.filter((r) => r.active).length,
    teachers: rows.reduce((s, r) => s + r.teachers, 0),
    adminAccounts: rows.reduce((s, r) => s + r.admins.length, 0),
    paying: paying.length,
    trial: rows.filter((r) => !r.plan.paid && !r.plan.expired).length,
    expired: rows.filter((r) => r.plan.expired).length,
    mrr,
    arr: mrr * 12,
    punchesToday: punchesToday ?? 0,
    punchesMonth: punchesMonth ?? 0,
    signups: [...byMonth.entries()].map(([month, count]) => ({ month, count })),
    expiring: paying.filter((r) => r.daysLeft !== null && r.daysLeft <= 30).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    conversion: rows.length ? Math.round((paying.length / rows.length) * 100) : 0,
  };
}

/* ---------------- Journal global ---------------- */
export interface GlobalActivity {
  id: string;
  schoolId: string;
  schoolName: string;
  actor: string | null;
  action: string;
  created_at: string;
}

export async function globalActivity(rows: SchoolRow[], limit = 120): Promise<GlobalActivity[]> {
  const names = new Map(rows.map((r) => [r.school.id, r.school.name]));
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("id,school_id,actor,action,created_at")
    .or("resource.is.null,and(resource.not.like.face:*,resource.not.like.auth-fail:*,resource.not.like.config:*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as { id: string; school_id: string; actor: string | null; action: string; created_at: string }[] | null) ?? []).map((r) => ({
    id: r.id,
    schoolId: r.school_id,
    schoolName: names.get(r.school_id) ?? "—",
    actor: r.actor,
    action: r.action,
    created_at: r.created_at,
  }));
}

/* ---------------- Comptes ---------------- */
export interface TeacherAccountRow {
  id: string;
  name: string;
  phone: string | null;
  schoolId: string;
  schoolName: string;
  status: string;
  hasCode: boolean;
  created_at: string;
}

export async function listAllTeachers(rows: SchoolRow[], limit = 500): Promise<TeacherAccountRow[]> {
  const names = new Map(rows.map((r) => [r.school.id, r.school.name]));
  const { data } = await supabaseAdmin()
    .from("teachers")
    .select("id,school_id,first_name,last_name,phone,status,user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as { id: string; school_id: string; first_name: string; last_name: string; phone: string | null; status: string; user_id: string | null; created_at: string }[] | null) ?? []).map((t) => ({
    id: t.id,
    name: `${t.first_name} ${t.last_name}`,
    phone: t.phone,
    schoolId: t.school_id,
    schoolName: names.get(t.school_id) ?? "—",
    status: t.status,
    hasCode: !!t.user_id,
    created_at: t.created_at,
  }));
}
