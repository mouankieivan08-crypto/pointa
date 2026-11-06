"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checkConsoleKey,
  setConsoleSession,
  isConsoleSession,
  clearConsoleSession,
  setAuthUserPassword,
  temporaryPassword,
  deleteAuthUser,
  listSchoolAdmins,
  isPlatformOwner,
  verifyLogin,
} from "./auth";
import { setSchoolPlan, getSchoolPlan } from "./plan";
import { getSchool, purgeSchool, notifyAdmin } from "./db";
import { PLAN_LIMITS, PLAN_NAMES, type PlanId } from "@/config/pricing";
import { localToday, addDays, numericDate } from "./time";

/**
 * Console plateforme (équipe Pointa / Bongisa) : activation des abonnements,
 * réinitialisation d'accès, suppression d'établissements de test.
 * Chaque action revérifie la session console.
 */
export interface ConsoleState {
  error?: string;
  ok?: string;
}

const CONSOLE_ACTOR = "Équipe Pointa";

async function guard() {
  if (!(await isConsoleSession())) redirect("/console");
}

function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Deux façons d'ouvrir la console :
 * — email + mot de passe d'un propriétaire déclaré dans CONSOLE_EMAILS (usage courant) ;
 * — clé d'accès CONSOLE_KEY (secours, si le mot de passe est perdu).
 */
export async function consoleLoginAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await new Promise((r) => setTimeout(r, 700)); // ralentit les essais au hasard
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const key = String(formData.get("key") ?? "");

  if (email || password) {
    if (!email || !password) return { error: "Renseignez l'email et le mot de passe." };
    if (!isPlatformOwner(email)) return { error: "Ce compte n'a pas accès à la console." };
    const user = await verifyLogin(email, password);
    if (!user) return { error: "Email ou mot de passe incorrect." };
    await setConsoleSession(email);
    redirect("/console");
  }

  if (!checkConsoleKey(key)) return { error: "Clé invalide." };
  await setConsoleSession();
  redirect("/console");
}

/** Le propriétaire choisit lui-même son mot de passe de console (= celui de son compte). */
export async function setOwnerPasswordAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await guard();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isPlatformOwner(email)) return { error: "Cet email n'est pas déclaré comme propriétaire de la plateforme." };
  if (password.length < 8) return { error: "Choisissez un mot de passe d'au moins 8 caractères : ce compte ouvre les données de tous les établissements." };

  const admins = [...(await listSchoolAdmins()).values()].flat();
  const account = admins.find((a) => a.email.toLowerCase() === email);
  if (!account) return { error: "Aucun compte ne porte cet email." };
  if (!(await setAuthUserPassword(account.id, password))) return { error: "Modification impossible. Réessayez." };
  return { ok: `Mot de passe mis à jour pour ${email}. Il sert aussi à ouvrir l'espace de son établissement.` };
}

export async function consoleLogoutAction() {
  await clearConsoleSession();
  redirect("/console");
}

export async function activatePlanAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await guard();
  const schoolId = String(formData.get("schoolId") ?? "");
  const plan = String(formData.get("plan") ?? "") as PlanId;
  if (!(plan in PLAN_LIMITS)) return { error: "Plan inconnu." };
  const school = await getSchool(schoolId);
  if (!school) return { error: "Établissement introuvable." };

  if (plan === "essai") {
    await setSchoolPlan(schoolId, { plan, until: null, actor: CONSOLE_ACTOR });
    await notifyAdmin(schoolId, null, "info", "Abonnement terminé", `Votre établissement est revenu à l'essai gratuit (${PLAN_LIMITS.essai} enseignants).`);
    revalidatePath("/console", "layout");
    return { ok: `${school.name} : retour à l'essai gratuit.` };
  }

  const months = Math.round(Number(formData.get("months")));
  if (!Number.isFinite(months) || months < 1 || months > 36) return { error: "Durée invalide (1 à 36 mois)." };
  const rawLimit = Number(formData.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(2000, Math.round(rawLimit)) : PLAN_LIMITS[plan];

  // Renouvellement : on prolonge à partir de l'échéance en cours.
  const current = await getSchoolPlan(schoolId);
  const startFrom = current.paid && current.until && current.until >= localToday() ? addDays(current.until, 1) : localToday();
  const until = addDays(addMonths(startFrom, months), -1);
  if (!(await setSchoolPlan(schoolId, { plan, until, limit, actor: CONSOLE_ACTOR }))) return { error: "Enregistrement impossible." };

  await notifyAdmin(schoolId, null, "info", `Abonnement ${PLAN_NAMES[plan]} activé`, `Merci ! Votre abonnement couvre ${limit} enseignants jusqu'au ${numericDate(until)}.`);
  revalidatePath("/console", "layout");
  return { ok: `${school.name} : ${PLAN_NAMES[plan]} (${limit} enseignants) jusqu'au ${numericDate(until)}.` };
}

export async function resetAdminPasswordAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await guard();
  const schoolId = String(formData.get("schoolId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const admin = ((await listSchoolAdmins()).get(schoolId) ?? []).find((a) => a.id === userId);
  if (!admin) return { error: "Compte introuvable pour cet établissement." };
  const password = temporaryPassword();
  if (!(await setAuthUserPassword(userId, password))) return { error: "Réinitialisation impossible." };
  return { ok: `Nouveau mot de passe pour ${admin.email} : ${password}` };
}

/** Message de l'équipe Pointa à la direction d'un établissement (relance, information). */
export async function sendNoticeAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await guard();
  const schoolId = String(formData.get("schoolId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 90);
  const body = String(formData.get("body") ?? "").trim().slice(0, 400);
  const school = await getSchool(schoolId);
  if (!school) return { error: "Établissement introuvable." };
  if (!title || !body) return { error: "Un titre et un message sont nécessaires." };
  await notifyAdmin(schoolId, null, "info", title, body);
  revalidatePath("/console", "layout");
  return { ok: `Message envoyé à ${school.name}.` };
}

export async function deleteSchoolAction(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await guard();
  const schoolId = String(formData.get("schoolId") ?? "");
  const school = await getSchool(schoolId);
  if (!school) return { error: "Établissement introuvable." };
  if (String(formData.get("confirm") ?? "").trim() !== school.name) return { error: "Tapez exactement le nom de l'établissement pour confirmer." };

  const admins = (await listSchoolAdmins()).get(schoolId) ?? [];
  const teacherAccounts = await purgeSchool(schoolId);
  for (const id of [...teacherAccounts, ...admins.map((a) => a.id)]) await deleteAuthUser(id);
  revalidatePath("/console", "layout");
  return { ok: `« ${school.name} » a été supprimé (données, fichiers et comptes).` };
}
