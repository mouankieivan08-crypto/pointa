import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { localToday, numericDate } from "./time";
import { PLAN_LIMITS, PLAN_NAMES, type PlanId } from "@/config/pricing";

/**
 * Abonnement d'un établissement.
 * Chaque activation est un événement horodaté du journal (activity_log, resource « plan:{…} ») :
 * l'historique reste consultable par l'établissement et le dernier événement fait foi.
 */
export interface SchoolPlan {
  id: PlanId;
  name: string;
  maxTeachers: number;
  until: string | null; // dernier jour couvert (inclus), null = sans échéance
  paid: boolean;
  /** Abonnement payant arrivé à échéance : retour aux limites de l'essai gratuit. */
  expired: boolean;
  expiredPlanName?: string;
}

interface PlanEvent {
  plan: PlanId;
  limit: number;
  until: string | null;
}

const ESSAI: SchoolPlan = { id: "essai", name: PLAN_NAMES.essai, maxTeachers: PLAN_LIMITS.essai, until: null, paid: false, expired: false };

function parse(resource: string | null | undefined): PlanEvent | null {
  if (!resource?.startsWith("plan:")) return null;
  try {
    const ev = JSON.parse(resource.slice(5)) as PlanEvent;
    return ev && ev.plan in PLAN_LIMITS ? ev : null;
  } catch {
    return null;
  }
}

function resolve(ev: PlanEvent | null): SchoolPlan {
  if (!ev || ev.plan === "essai") return ESSAI;
  if (ev.until && ev.until < localToday()) {
    return { ...ESSAI, expired: true, expiredPlanName: PLAN_NAMES[ev.plan], until: ev.until };
  }
  return { id: ev.plan, name: PLAN_NAMES[ev.plan], maxTeachers: ev.limit || PLAN_LIMITS[ev.plan], until: ev.until, paid: true, expired: false };
}

export async function getSchoolPlan(schoolId: string): Promise<SchoolPlan> {
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("resource")
    .eq("school_id", schoolId)
    .like("resource", "plan:%")
    .order("created_at", { ascending: false })
    .limit(1);
  return resolve(parse((data as { resource: string | null }[] | null)?.[0]?.resource));
}

/** Plans de tous les établissements (console). */
export async function getAllSchoolPlans(): Promise<Map<string, SchoolPlan>> {
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("school_id,resource,created_at")
    .like("resource", "plan:%")
    .order("created_at", { ascending: false });
  const out = new Map<string, SchoolPlan>();
  for (const r of (data as { school_id: string; resource: string | null }[] | null) ?? []) {
    if (!out.has(r.school_id)) out.set(r.school_id, resolve(parse(r.resource)));
  }
  return out;
}

/** Active (ou retire) un abonnement. `until` = dernier jour couvert. */
export async function setSchoolPlan(schoolId: string, input: { plan: PlanId; until: string | null; limit?: number; actor: string }) {
  const essai = input.plan === "essai";
  const limit = essai ? PLAN_LIMITS.essai : Math.max(1, Math.round(input.limit || PLAN_LIMITS[input.plan]));
  const ev: PlanEvent = { plan: input.plan, limit, until: essai ? null : input.until };
  const action = essai
    ? "a remis l'établissement sur l'essai gratuit"
    : `a activé l'abonnement ${PLAN_NAMES[input.plan]} (${limit} enseignants)${ev.until ? ` jusqu'au ${numericDate(ev.until)}` : ""}`;
  const { error } = await supabaseAdmin()
    .from("activity_log")
    .insert({ school_id: schoolId, actor: input.actor, action, resource: `plan:${JSON.stringify(ev)}` });
  return !error;
}
