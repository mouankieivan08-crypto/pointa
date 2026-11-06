"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAuthUser,
  updateAuthUserMetadata,
  deleteAuthUser,
  verifyLogin,
  setSession,
  clearSession,
  getSession,
  setTeacherSession,
  getTeacherSession,
  clearTeacherSession,
  createTeacherAuthUser,
  verifyTeacherCode,
  setAuthUserPassword,
  type Session,
  type TeacherSession,
} from "./auth";
import {
  createSchool,
  getSchool,
  getTeacherAuth,
  findTeachersByPhone,
  createTeacher,
  updateTeacher,
  replaceWeeklyAssignments,
  setTeacherStatus,
  deleteTeacher,
  setTeacherUserId,
  updateTeacherPhoto,
  replaceTeacherFile,
  countActiveTeachers,
  createOneOffSession,
  deleteOneOffSession,
  listSchoolSlots,
  uploadFile,
  attendancePhotoPath,
  recordAttendance,
  saveManualAttendance,
  deleteAttendance,
  createLeave,
  setLeaveStatus,
  deleteLeave,
  logActivity,
  countRecentActivity,
  notifyAdmin,
  notifiedRecently,
  savePushSubscription,
  createDepartment,
  updateSchoolSettings,
  updateSchoolType,
  updateSchoolLocation,
  type TeacherLoginCandidate,
  type TeacherAuth,
} from "./db";
import { getSchoolPlan } from "./plan";
import { setSchoolConfig, getSchoolConfig } from "./school-config";
import { saveFaceReference, getFaceReference, removeFaceReference, logFaceCheck } from "./face";
import { recordEvent } from "./analytics";
import { faceVerdict, type FaceStatus } from "@/config/face";
import { STRUCTURES, STAFF_SIZES } from "@/config/structures";
import { arrivalLateness, teacherDaySchedule } from "./metrics";
import { normalizePhone, isValidPhone } from "./phone";
import { localNowMinutes, minToHHMM, localToday, localDateOf, localMinutesOf, isIsoDate, hhmmToMin, localToIso, WEEKDAYS, numericDate, addDays } from "./time";
import { haversineMeters, isWithinGeofence, DEFAULT_LATE_TOLERANCE, DEFAULT_GEOFENCE_RADIUS_M } from "@/config/rules";
import type { Assignment } from "./types";

export interface ActionState {
  error?: string;
  ok?: string;
}

/* ================================================================
   Utilitaires (non exportés)
   ================================================================ */
const text = (fd: FormData, key: string, max = 120) => String(fd.get(key) ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const actor = (s: Session) => s.name || "La direction";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };

function fileField(fd: FormData, key: string, types: Record<string, string>, maxMb: number): { file: File; ext: string } | { error: string } | null {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) return null;
  const ext = types[f.type];
  if (!ext) return { error: "Format de fichier non accepté (JPG, PNG, WEBP ou PDF)." };
  if (f.size > maxMb * 1024 * 1024) return { error: `Fichier trop lourd (${maxMb} Mo maximum).` };
  return { file: f, ext };
}

/** Emploi du temps envoyé par le formulaire : validé créneau par créneau. */
function parseAssignments(raw: string): { list: Assignment[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw || "[]");
  } catch {
    return { error: "Emploi du temps illisible. Rechargez la page." };
  }
  if (!Array.isArray(data) || data.length > 60) return { error: "Emploi du temps invalide." };
  const list: Assignment[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const classe = String(r.classe ?? "").trim().slice(0, 40);
    const day = String(r.day ?? "");
    const s = hhmmToMin(String(r.startTime ?? ""));
    const e = hhmmToMin(String(r.endTime ?? ""));
    const rate = Math.round(Number(r.hourlyRate));
    if (!classe) return { error: "Chaque créneau doit avoir une classe." };
    if (!WEEKDAYS.includes(day)) return { error: `Jour invalide pour la classe ${classe}.` };
    if (s == null || e == null || e <= s) return { error: `Horaires invalides pour ${classe} (${day}) : la fin doit être après le début.` };
    if (!Number.isFinite(rate) || rate < 0 || rate > 100000) return { error: `Taux horaire invalide pour ${classe}.` };
    list.push({ classe, day, startTime: minToHHMM(s), endTime: minToHHMM(e), hoursPerWeek: Math.round(((e - s) / 60) * 100) / 100, hourlyRate: rate });
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.day === b.day && hhmmToMin(a.startTime)! < hhmmToMin(b.endTime)! && hhmmToMin(b.startTime)! < hhmmToMin(a.endTime)!) {
        return { error: `Deux créneaux se chevauchent le ${a.day} (${a.startTime}–${a.endTime} et ${b.startTime}–${b.endTime}).` };
      }
    }
  }
  return { list };
}

/**
 * Empreinte du visage calculée par le navigateur à partir de la photo d'inscription.
 * Absente si l'appareil n'a pas pu charger les modèles : la fiche le signale et la
 * direction peut réessayer, le reste de l'enregistrement n'est pas bloqué.
 */
async function saveFaceFromForm(teacherId: string, fd: FormData): Promise<boolean> {
  const raw = fd.get("faceDescriptor");
  if (typeof raw !== "string" || raw.length < 2 || raw.length > 4000) return false;
  try {
    const d = JSON.parse(raw);
    if (!Array.isArray(d) || d.length !== 128) return false;
    return await saveFaceReference(teacherId, d as number[]);
  } catch {
    return false;
  }
}

/**
 * Conflit d'emploi du temps au niveau de l'établissement : la même classe ne peut pas
 * avoir deux enseignants en même temps. La direction peut confirmer (co-enseignement).
 */
async function classConflict(schoolId: string, teacherId: string | null, list: Assignment[]): Promise<string | null> {
  if (!list.length) return null;
  const others = (await listSchoolSlots(schoolId)).filter((s) => s.teacherId !== teacherId);
  if (!others.length) return null;
  for (const a of list) {
    const as = hhmmToMin(a.startTime ?? "");
    const ae = hhmmToMin(a.endTime ?? "");
    if (as == null || ae == null) continue;
    for (const o of others) {
      if (o.day !== a.day || o.classe.trim().toLowerCase() !== a.classe.trim().toLowerCase()) continue;
      const os = hhmmToMin(o.start);
      const oe = hhmmToMin(o.end);
      if (os == null || oe == null) continue;
      if (as < oe && os < ae) return `${a.classe} a déjà cours avec ${o.teacherName} le ${a.day.toLowerCase()} de ${o.start} à ${o.end}.`;
    }
  }
  return null;
}

function teacherFields(fd: FormData): { firstName: string; lastName: string; subject: string; phone: string; email: string | null } | { error: string } {
  const firstName = text(fd, "firstName", 60);
  const lastName = text(fd, "lastName", 60);
  const subject = text(fd, "subject", 60);
  const phone = normalizePhone(text(fd, "phone", 30));
  const email = text(fd, "email", 120).toLowerCase();
  if (!firstName || !lastName) return { error: "Le prénom et le nom sont requis." };
  if (!isValidPhone(phone)) return { error: "Numéro de téléphone invalide (ex : 06 100 20 30)." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  return { firstName, lastName, subject, phone, email: email || null };
}

const LEAVE_TYPES = ["Maladie", "Congé", "Événement familial", "Formation", "Autre"];

function leaveFields(fd: FormData): { type: string; start: string; end: string; reason: string | null } | { error: string } {
  const rawType = text(fd, "type", 40);
  const type = LEAVE_TYPES.includes(rawType) ? rawType : "Autre";
  const start = text(fd, "start", 10);
  const end = text(fd, "end", 10) || start;
  if (!isIsoDate(start) || !isIsoDate(end)) return { error: "Dates invalides." };
  if (end < start) return { error: "La date de fin doit être après la date de début." };
  if (addDays(start, 90) < end) return { error: "Période trop longue (90 jours maximum)." };
  return { type, start, end, reason: text(fd, "reason", 300) || null };
}

/** Session enseignant revalidée contre la base (statut actif, code non réinitialisé). */
async function currentTeacher(): Promise<{ ts: TeacherSession; t: TeacherAuth } | null> {
  const ts = await getTeacherSession();
  if (!ts) return null;
  const t = await getTeacherAuth(ts.schoolId, ts.teacherId);
  if (!t || t.status !== "active" || (t.userId ?? null) !== ts.authId) return null;
  return { ts, t };
}

/* ================================================================
   Direction : inscription, connexion
   ================================================================ */
export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (text(formData, "website")) return { error: "Inscription impossible." }; // champ piège anti-robots
  const schoolName = text(formData, "company", 80);
  const adminName = text(formData, "name", 80);
  const email = text(formData, "email", 120).toLowerCase();
  const rawPhone = text(formData, "phone", 30);
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  const city = text(formData, "city", 60);
  const password = String(formData.get("password") ?? "");

  if (!schoolName || !adminName || !email) return { error: "Veuillez remplir tous les champs obligatoires." };
  if (!EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (phone && !isValidPhone(phone)) return { error: "Numéro de téléphone invalide." };
  if (password.length < 8) return { error: "Le mot de passe doit faire au moins 8 caractères." };

  const user = await createAuthUser(email, password, { name: adminName });
  if ("error" in user) return user;

  const school = await createSchool({ name: schoolName, email, phone: phone || null, city: city || null });
  if ("error" in school) {
    await deleteAuthUser(user.id);
    return { error: "Impossible de créer l'établissement. Réessayez." };
  }

  await updateAuthUserMetadata(user.id, { name: adminName, school_id: school.id });
  await logActivity(school.id, adminName, "a créé le compte de l'établissement");
  await recordEvent({ kind: "inscription", path: "/signup" });
  await setSession(school.id, user.id, adminName);
  redirect("/onboarding");
}

/* ---------------- Mise en route : adapter Pointa à la structure ---------------- */
export async function saveOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const kind = text(formData, "kind", 30);
  const structure = STRUCTURES.find((x) => x.kind === kind);
  if (!structure) return { error: "Choisissez le type de votre établissement." };

  let levels: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("levels") ?? "[]"));
    if (Array.isArray(raw)) levels = [...new Set(raw.map((l) => String(l).trim().slice(0, 40)).filter(Boolean))].slice(0, 40);
  } catch {
    levels = [];
  }
  const sizeRaw = text(formData, "staffSize", 20);
  const staffSize = (STAFF_SIZES as readonly string[]).includes(sizeRaw) ? sizeRaw : null;

  await setSchoolConfig(s.schoolId, { kind: structure.kind, levels, staffSize, actor: actor(s) });
  await updateSchoolType(s.schoolId, structure.label);

  // Position facultative captée pendant la mise en route
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    await updateSchoolLocation(s.schoolId, lat, lng, DEFAULT_GEOFENCE_RADIUS_M);
    await logActivity(s.schoolId, actor(s), `a validé la localisation de l'établissement (rayon ${DEFAULT_GEOFENCE_RADIUS_M} m)`);
  }
  revalidatePath("/app", "layout");
  redirect("/app?bienvenue=1");
}

/** Changement du type de structure / des niveaux depuis les paramètres. */
export async function saveStructureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const structure = STRUCTURES.find((x) => x.kind === text(formData, "kind", 30));
  if (!structure) return { error: "Type d'établissement inconnu." };
  const levels = text(formData, "levels", 800)
    .split(",")
    .map((l) => l.trim().slice(0, 40))
    .filter(Boolean);
  await setSchoolConfig(s.schoolId, { kind: structure.kind, levels: [...new Set(levels)].slice(0, 40), staffSize: null, actor: actor(s) });
  await updateSchoolType(s.schoolId, structure.label);
  revalidatePath("/app", "layout");
  return { ok: "Type d'établissement enregistré." };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email", 120).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Veuillez remplir tous les champs." };

  const user = await verifyLogin(email, password);
  if (!user || user.role === "teacher") {
    await sleep(400);
    return { error: "Email ou mot de passe incorrect." };
  }
  if (!user.schoolId || !(await getSchool(user.schoolId))) return { error: "Aucun établissement lié à ce compte. Contactez le support." };

  await setSession(user.schoolId, user.id, user.name ?? "");
  redirect("/app");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

/* ================================================================
   Enseignants (direction)
   ================================================================ */
export async function createTeacherAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();

  // Limite de l'abonnement (essai gratuit : 5 enseignants actifs).
  const [plan, active] = await Promise.all([getSchoolPlan(s.schoolId), countActiveTeachers(s.schoolId)]);
  if (active >= plan.maxTeachers) {
    return {
      error: plan.paid
        ? `Votre abonnement ${plan.name} couvre ${plan.maxTeachers} enseignants. Contactez-nous pour l'étendre (menu « Abonnement »).`
        : `L'essai gratuit couvre ${plan.maxTeachers} enseignants. Pour en ajouter d'autres, activez un abonnement (menu « Abonnement »).`,
    };
  }

  const fields = teacherFields(formData);
  if ("error" in fields) return fields;
  const slots = parseAssignments(String(formData.get("assignments") ?? "[]"));
  if ("error" in slots) return slots;
  const photo = fileField(formData, "photo", IMAGE_TYPES, 3);
  if (photo && "error" in photo) return photo;
  if (!photo) return { error: "La photo d'inscription est obligatoire : c'est elle qui sert à vérifier le visage à chaque pointage." };
  const doc = fileField(formData, "timetable", DOC_TYPES, 3.5);
  if (doc && "error" in doc) return doc;

  if (formData.get("allowConflict") !== "1") {
    const conflict = await classConflict(s.schoolId, null, slots.list);
    if (conflict) return { error: conflict };
  }

  const res = await createTeacher(s.schoolId, fields, slots.list);
  if ("error" in res) {
    return { error: res.error === "duplicate_phone" ? "Ce numéro est déjà utilisé par un enseignant de votre établissement." : "Enregistrement impossible. Réessayez." };
  }

  const path = await replaceTeacherFile(res.id, "photo", photo.file, photo.file.type, photo.ext);
  if (path) await updateTeacherPhoto(res.id, path);
  await saveFaceFromForm(res.id, formData);
  if (doc) await replaceTeacherFile(res.id, "emploi-du-temps", doc.file, doc.file.type, doc.ext);

  await logActivity(s.schoolId, actor(s), `a ajouté l'enseignant ${fields.firstName} ${fields.lastName}`);
  revalidatePath("/app", "layout");
  redirect(`/app/employees/${res.id}?nouveau=1`);
}

export async function updateTeacherAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const id = text(formData, "teacherId", 64);
  const current = await getTeacherAuth(s.schoolId, id);
  if (!current) return { error: "Enseignant introuvable." };

  const fields = teacherFields(formData);
  if ("error" in fields) return fields;
  const slots = parseAssignments(String(formData.get("assignments") ?? "[]"));
  if ("error" in slots) return slots;
  const photo = fileField(formData, "photo", IMAGE_TYPES, 3);
  if (photo && "error" in photo) return photo;
  const doc = fileField(formData, "timetable", DOC_TYPES, 3.5);
  if (doc && "error" in doc) return doc;

  if (formData.get("allowConflict") !== "1") {
    const conflict = await classConflict(s.schoolId, id, slots.list);
    if (conflict) return { error: conflict };
  }

  const res = await updateTeacher(s.schoolId, id, fields);
  if ("error" in res) {
    return { error: res.error === "duplicate_phone" ? "Ce numéro est déjà utilisé par un autre enseignant de votre établissement." : "Enregistrement impossible. Réessayez." };
  }
  if (!(await replaceWeeklyAssignments(id, slots.list))) return { error: "L'emploi du temps n'a pas pu être enregistré. Réessayez." };
  if (photo) {
    const path = await replaceTeacherFile(id, "photo", photo.file, photo.file.type, photo.ext);
    if (path) await updateTeacherPhoto(id, path);
    // Nouvelle photo = nouvelle empreinte de référence (l'ancienne ne vaut plus).
    if (!(await saveFaceFromForm(id, formData))) await removeFaceReference(id);
  }
  if (doc) await replaceTeacherFile(id, "emploi-du-temps", doc.file, doc.file.type, doc.ext);

  await logActivity(s.schoolId, actor(s), `a modifié la fiche de ${fields.firstName} ${fields.lastName}`);
  revalidatePath("/app", "layout");
  redirect(`/app/employees/${id}?modifie=1`);
}

export async function setTeacherStatusAction(formData: FormData) {
  const s = await requireSession();
  const id = text(formData, "teacherId", 64);
  const status = formData.get("status") === "active" ? "active" : "archived";
  const t = await getTeacherAuth(s.schoolId, id);
  if (!t) redirect("/app/employees");

  if (status === "active" && t.status === "archived") {
    const [plan, active] = await Promise.all([getSchoolPlan(s.schoolId), countActiveTeachers(s.schoolId)]);
    if (active >= plan.maxTeachers) redirect(`/app/employees/${id}?erreur=limite`);
  }
  await setTeacherStatus(s.schoolId, id, status);
  await logActivity(s.schoolId, actor(s), status === "archived" ? `a archivé ${t.firstName} ${t.lastName}` : `a réactivé ${t.firstName} ${t.lastName}`);
  revalidatePath("/app", "layout");
  redirect(`/app/employees/${id}`);
}

export async function deleteTeacherAction(formData: FormData) {
  const s = await requireSession();
  const id = text(formData, "teacherId", 64);
  if (text(formData, "confirm", 20).toUpperCase() !== "SUPPRIMER") redirect(`/app/employees/${id}?erreur=confirmation`);
  const removed = await deleteTeacher(s.schoolId, id);
  if (removed?.userId) await deleteAuthUser(removed.userId);
  if (removed) await logActivity(s.schoolId, actor(s), `a supprimé l'enseignant ${removed.name} et son historique`);
  revalidatePath("/app", "layout");
  redirect("/app/employees");
}

/** Oubli de code : l'enseignant se reconnecte avec son numéro, puis choisit un nouveau code. */
export async function resetTeacherCodeAction(formData: FormData) {
  const s = await requireSession();
  const id = text(formData, "teacherId", 64);
  const t = await getTeacherAuth(s.schoolId, id);
  if (!t) redirect("/app/employees");
  if (t.userId) {
    await deleteAuthUser(t.userId);
    await setTeacherUserId(t.id, null);
  }
  await logActivity(s.schoolId, actor(s), `a réinitialisé le code personnel de ${t.firstName} ${t.lastName}`);
  redirect(`/app/employees/${id}?code=reinitialise`);
}

/* ---------------- Séances ponctuelles : remplacements, heures supplémentaires ---------------- */
export async function createSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const teacherId = text(formData, "teacherId", 64);
  const t = await getTeacherAuth(s.schoolId, teacherId);
  if (!t) return { error: "Enseignant introuvable." };

  const kind = formData.get("kind") === "remplacement" ? "remplacement" : "supplementaire";
  const date = text(formData, "date", 10);
  const classe = text(formData, "classe", 40);
  const sm = hhmmToMin(text(formData, "start", 5));
  const em = hhmmToMin(text(formData, "end", 5));
  const rate = Math.round(Number(formData.get("rate")));
  const today = localToday();
  if (!isIsoDate(date) || date < addDays(today, -62) || date > addDays(today, 180)) return { error: "Date invalide (deux mois en arrière au maximum)." };
  if (sm == null || em == null || em <= sm) return { error: "Horaires invalides : la fin doit être après le début." };
  if (!classe) return { error: "Indiquez la classe." };
  if (!Number.isFinite(rate) || rate < 0 || rate > 100000) return { error: "Taux horaire invalide." };

  const existing = await teacherDaySchedule(teacherId, date);
  if (existing.some((x) => hhmmToMin(x.start)! < em && sm < hhmmToMin(x.end)!)) {
    return { error: `${t.firstName} a déjà un cours sur ce créneau ce jour-là.` };
  }

  let label = `${classe} · Séance supplémentaire`;
  if (kind === "remplacement") {
    const replacedId = text(formData, "replacedId", 64);
    const r = replacedId ? await getTeacherAuth(s.schoolId, replacedId) : null;
    label = `${classe} · Remplacement${r ? ` de ${r.firstName} ${r.lastName}` : ""}`;
  }
  label = label.slice(0, 80);
  const start = minToHHMM(sm);
  const end = minToHHMM(em);
  const hours = Math.round(((em - sm) / 60) * 100) / 100;
  if (!(await createOneOffSession(teacherId, { date, start, end, label, rate, hours }))) return { error: "Enregistrement impossible. Réessayez." };

  await logActivity(s.schoolId, actor(s), `a programmé ${label} pour ${t.firstName} ${t.lastName}, le ${numericDate(date)} de ${start} à ${end}`);
  revalidatePath(`/app/employees/${teacherId}`);
  return { ok: "Séance ajoutée. Elle sera payée si l'enseignant pointe sa présence." };
}

export async function deleteSessionAction(formData: FormData) {
  const s = await requireSession();
  const removed = await deleteOneOffSession(s.schoolId, text(formData, "sessionId", 64));
  if (removed) {
    await logActivity(s.schoolId, actor(s), `a annulé la séance ${removed.label} du ${numericDate(removed.date)}`);
    revalidatePath(`/app/employees/${removed.teacherId}`);
  }
}

/* ---------------- Absences justifiées & congés ---------------- */
export async function createLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const t = await getTeacherAuth(s.schoolId, text(formData, "teacherId", 64));
  if (!t) return { error: "Choisissez un enseignant." };
  const f = leaveFields(formData);
  if ("error" in f) return f;
  if (!(await createLeave(s.schoolId, t.id, { ...f, status: "accepted" }))) return { error: "Enregistrement impossible. Réessayez." };
  await logActivity(s.schoolId, actor(s), `a enregistré une absence justifiée (${f.type}) pour ${t.firstName} ${t.lastName} du ${numericDate(f.start)} au ${numericDate(f.end)}`);
  revalidatePath("/app", "layout");
  return { ok: "Absence enregistrée : ces jours ne comptent pas comme des absences." };
}

export async function decideLeaveAction(formData: FormData) {
  const s = await requireSession();
  const decision = formData.get("decision") === "accepted" ? "accepted" : "refused";
  const leave = await setLeaveStatus(s.schoolId, text(formData, "leaveId", 64), decision);
  if (leave) {
    const t = await getTeacherAuth(s.schoolId, leave.teacher_id);
    const who = t ? `${t.firstName} ${t.lastName}` : "un enseignant";
    await logActivity(s.schoolId, actor(s), `a ${decision === "accepted" ? "accepté" : "refusé"} la demande de ${who} (${leave.type}, du ${numericDate(leave.start_date)} au ${numericDate(leave.end_date)})`);
  }
  revalidatePath("/app", "layout");
}

export async function deleteLeaveAction(formData: FormData) {
  const s = await requireSession();
  const leave = await deleteLeave(s.schoolId, text(formData, "leaveId", 64));
  if (leave) await logActivity(s.schoolId, actor(s), `a supprimé une absence (${leave.type}, du ${numericDate(leave.start_date)} au ${numericDate(leave.end_date)})`);
  revalidatePath("/app", "layout");
}

/* ---------------- Correction d'un pointage (tracée) ---------------- */
export async function correctAttendanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const teacherId = text(formData, "teacherId", 64);
  const date = text(formData, "date", 10);
  const t = await getTeacherAuth(s.schoolId, teacherId);
  if (!t) return { error: "Enseignant introuvable." };
  if (!isIsoDate(date) || date > localToday()) return { error: "Date invalide." };

  const arrival = text(formData, "arrival", 5);
  const departure = text(formData, "departure", 5);
  const reason = text(formData, "reason", 200);
  const valid = formData.get("valid") === "on";
  if (!reason) return { error: "Indiquez le motif de la correction (il est conservé au journal)." };
  const am = arrival ? hhmmToMin(arrival) : null;
  const dm = departure ? hhmmToMin(departure) : null;
  if ((arrival && am == null) || (departure && dm == null)) return { error: "Heure invalide." };
  if (am != null && dm != null && dm <= am) return { error: "Le départ doit être après l'arrivée." };

  const who = `${t.firstName} ${t.lastName}`;
  if (am == null && dm == null) {
    await deleteAttendance(s.schoolId, teacherId, date);
    await logActivity(s.schoolId, actor(s), `a supprimé le pointage de ${who} du ${numericDate(date)} — motif : ${reason}`);
  } else {
    const school = await getSchool(s.schoolId);
    const tol = school?.late_tolerance_min ?? DEFAULT_LATE_TOLERANCE;
    const slots = await teacherDaySchedule(teacherId, date);
    const first = slots.length ? Math.min(...slots.map((x) => hhmmToMin(x.start)!)) : null;
    const late = am != null && first != null && am - first > tol ? am - first : 0;
    const ok = await saveManualAttendance(s.schoolId, teacherId, date, {
      checkIn: am != null ? localToIso(date, minToHHMM(am)) : null,
      checkOut: dm != null ? localToIso(date, minToHHMM(dm)) : null,
      valid,
      lateMinutes: late,
    });
    if (!ok) return { error: "Enregistrement impossible. Réessayez." };
    await logActivity(
      s.schoolId,
      actor(s),
      `a corrigé le pointage de ${who} du ${numericDate(date)} (arrivée ${arrival || "—"}, départ ${departure || "—"}${valid ? "" : ", non validé"}) — motif : ${reason}`,
    );
  }
  revalidatePath("/app", "layout");
  redirect(`/app/attendance?date=${date}`);
}

/* ---------------- Établissement ---------------- */
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const name = text(formData, "name", 80);
  if (!name) return { error: "Le nom de l'établissement est requis." };
  const rawPhone = text(formData, "phone", 30);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (phone && !isValidPhone(phone)) return { error: "Numéro de téléphone invalide." };
  const tol = Math.round(Number(formData.get("tolerance")));
  if (!Number.isFinite(tol) || tol < 0 || tol > 60) return { error: "Tolérance de retard invalide (0 à 60 minutes)." };
  const ok = await updateSchoolSettings(s.schoolId, { name, type: text(formData, "type", 60) || null, city: text(formData, "city", 60) || null, phone, lateToleranceMin: tol });
  if (!ok) return { error: "Enregistrement impossible. Réessayez." };

  const faceStrict = formData.get("faceStrict") === "1";
  const current = await getSchoolConfig(s.schoolId);
  if (current.faceStrict !== faceStrict) {
    await setSchoolConfig(s.schoolId, {
      faceStrict,
      actor: actor(s),
      action: faceStrict
        ? "a activé le refus des pointages dont le visage ne correspond pas"
        : "a désactivé le refus des pointages dont le visage ne correspond pas",
    });
  }
  await logActivity(s.schoolId, actor(s), `a mis à jour les paramètres de l'établissement (tolérance de retard : ${tol} min)`);
  revalidatePath("/app", "layout");
  return { ok: "Paramètres enregistrés." };
}

export async function saveLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSession();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radius = Math.min(500, Math.max(30, Math.round(Number(formData.get("radius")) || DEFAULT_GEOFENCE_RADIUS_M)));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return { error: "Position invalide. Utilisez « Ma position actuelle » depuis l'établissement, ou saisissez les coordonnées." };
  }
  if (!(await updateSchoolLocation(s.schoolId, lat, lng, radius))) return { error: "Enregistrement impossible. Réessayez." };
  await logActivity(s.schoolId, actor(s), `a validé la localisation de l'établissement (rayon ${radius} m)`);
  revalidatePath("/app", "layout");
  redirect("/app?loc=ok");
}

export async function createDepartmentAction(formData: FormData) {
  const s = await requireSession();
  const name = text(formData, "name", 60);
  if (name) await createDepartment(s.schoolId, name);
  redirect("/app/sites");
}

/* ================================================================
   Espace enseignant
   ================================================================ */
export interface TeacherLoginState {
  error?: string;
  choices?: { id: string; school: string }[];
}

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

async function isLocked(c: TeacherLoginCandidate): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  return (await countRecentActivity(c.schoolId, `auth-fail:${c.id}`, since)) >= MAX_FAILS;
}

export async function teacherLoginAction(_prev: TeacherLoginState, formData: FormData): Promise<TeacherLoginState> {
  const phone = normalizePhone(text(formData, "phone", 30));
  const secret = String(formData.get("password") ?? "").trim().slice(0, 64);
  const chosen = text(formData, "teacherId", 64);
  if (!phone || !secret) return { error: "Renseignez votre numéro et votre code." };

  let candidates = await findTeachersByPhone(phone);
  if (chosen) candidates = candidates.filter((c) => c.id === chosen);
  if (!candidates.length) {
    await sleep(500);
    return { error: "Numéro ou code incorrect." };
  }

  const valid: TeacherLoginCandidate[] = [];
  let locked = false;
  for (const c of candidates) {
    if (await isLocked(c)) {
      locked = true;
      continue;
    }
    // 1re connexion : le mot de passe est le numéro de téléphone ; ensuite, uniquement le code personnel.
    const ok = c.userId ? await verifyTeacherCode(c.id, secret) : normalizePhone(secret) === phone;
    if (ok) valid.push(c);
    else await logActivity(c.schoolId, c.firstName, "a échoué une connexion à l'espace enseignant", `auth-fail:${c.id}`);
  }

  if (!valid.length) {
    await sleep(500);
    return {
      error: locked
        ? `Trop d'essais. Réessayez dans ${LOCK_MINUTES} minutes, ou demandez à la direction de réinitialiser votre code.`
        : "Numéro ou code incorrect.",
    };
  }
  if (valid.length > 1) return { choices: valid.map((c) => ({ id: c.id, school: c.schoolName })) };

  const t = valid[0];
  await setTeacherSession(t.id, t.schoolId, t.firstName, t.userId);
  redirect("/espace");
}

export async function teacherLogoutAction() {
  await clearTeacherSession();
  redirect("/espace");
}

function weakCode(code: string, phone: string): boolean {
  if (/^(\d)\1+$/.test(code)) return true; // 000000, 111111…
  if ("01234567890123".includes(code) || "98765432109876".includes(code)) return true; // suites
  return phone.replace(/\D/g, "").includes(code);
}

/** Choix (1re connexion) ou changement du code personnel. */
export async function setTeacherCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cur = await currentTeacher();
  if (!cur) {
    await clearTeacherSession();
    redirect("/espace");
  }
  const { ts, t } = cur;
  const code = text(formData, "code", 12);
  if (!/^\d{6,12}$/.test(code)) return { error: "Le code doit contenir au moins 6 chiffres." };
  if (code !== text(formData, "confirm", 12)) return { error: "Les deux codes ne sont pas identiques." };
  if (weakCode(code, t.phone)) return { error: "Code trop facile à deviner (chiffres répétés, suite ou numéro de téléphone). Choisissez-en un autre." };

  if (t.userId) {
    if (!(await verifyTeacherCode(t.id, text(formData, "current", 64)))) return { error: "Code actuel incorrect." };
    if (!(await setAuthUserPassword(t.userId, code))) return { error: "Impossible d'enregistrer le code. Réessayez." };
    await setTeacherSession(t.id, ts.schoolId, ts.name, t.userId);
  } else {
    const created = await createTeacherAuthUser(t.id, ts.schoolId, code);
    if ("error" in created) return created;
    await setTeacherUserId(t.id, created.id);
    await setTeacherSession(t.id, ts.schoolId, ts.name, created.id);
  }
  await logActivity(ts.schoolId, `${t.firstName} ${t.lastName}`, t.userId ? "a changé son code personnel" : "a choisi son code personnel");
  redirect("/espace?code=ok");
}

export async function subscribePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
  const cur = await currentTeacher();
  if (!cur || typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub?.keys?.p256dh || !sub?.keys?.auth) return { ok: false };
  await savePushSubscription(cur.ts.schoolId, cur.t.id, sub);
  return { ok: true };
}

export async function requestLeaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cur = await currentTeacher();
  if (!cur) return { error: "Session expirée. Reconnectez-vous." };
  const f = leaveFields(formData);
  if ("error" in f) return f;
  if (!(await createLeave(cur.ts.schoolId, cur.t.id, { ...f, status: "pending" }))) return { error: "Envoi impossible. Réessayez." };
  await notifyAdmin(
    cur.ts.schoolId,
    cur.t.id,
    "conge",
    `Demande d'absence : ${cur.t.firstName} ${cur.t.lastName}`,
    `${f.type} du ${numericDate(f.start)} au ${numericDate(f.end)}${f.reason ? ` — ${f.reason}` : ""}.`,
  );
  revalidatePath("/espace");
  return { ok: "Demande envoyée à la direction." };
}

/* ---------------- Pointage ---------------- */
export interface PunchResult {
  ok?: boolean;
  error?: string;
  /** Pointage refusé : le visage filmé ne correspond pas à la photo d'inscription. */
  refusedFace?: boolean;
  kind?: "in" | "out";
  time?: string;
  withinGeofence?: boolean;
  distance?: number | null;
  positionMissing?: boolean;
  lateMinutes?: number;
  photoSaved?: boolean;
  face?: FaceStatus;
  faceDistance?: number | null;
  /** Pointage fait sans réseau et transmis plus tard. */
  deferred?: boolean;
  /** Pointage gardé sur le téléphone, pas encore reçu par le serveur. */
  queued?: boolean;
}

/** Un pointage fait hors ligne n'est plus accepté au-delà de ce délai. */
const OFFLINE_MAX_AGE_H = 72;

function coord(v: FormDataEntryValue | null, max: number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/** Empreinte du visage envoyée par le téléphone : 128 nombres, rien d'autre n'est accepté. */
function parseDescriptor(raw: FormDataEntryValue | null): number[] | null {
  if (typeof raw !== "string" || raw.length > 4000) return null;
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) && d.length === 128 && d.every((n) => typeof n === "number" && Number.isFinite(n)) ? d : null;
  } catch {
    return null;
  }
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export async function punchAction(formData: FormData): Promise<PunchResult> {
  const cur = await currentTeacher();
  if (!cur) {
    await clearTeacherSession();
    return { error: "Session expirée. Reconnectez-vous." };
  }
  const { ts, t } = cur;
  if (!t.userId) return { error: "Choisissez d'abord votre code personnel." };

  const kind = formData.get("kind") === "out" ? "out" : "in";
  const lat = coord(formData.get("lat"), 90);
  const lng = coord(formData.get("lng"), 180);
  const fullName = `${t.firstName} ${t.lastName}`;

  /* --- 0. Quand le pointage a-t-il eu lieu ? --- */
  // « at » = pointage fait hors ligne, transmis à la reconnexion. On garde l'heure réelle
  // du pointage, en refusant une date future ou trop ancienne (horloge du téléphone).
  const raw = text(formData, "at", 40);
  const stamp = raw ? Date.parse(raw) : NaN;
  const nowMs = Date.now();
  let at: string | undefined;
  let delayMinutes = 0;
  if (raw) {
    if (!Number.isFinite(stamp)) return { error: "Pointage hors ligne illisible." };
    if (stamp > nowMs + 5 * 60_000) return { error: "L'heure de votre téléphone est en avance : corrigez-la puis réessayez." };
    if (stamp < nowMs - OFFLINE_MAX_AGE_H * 3600_000) {
      return { error: `Ce pointage hors ligne a plus de ${OFFLINE_MAX_AGE_H} h : demandez à la direction de le saisir.` };
    }
    at = new Date(Math.min(stamp, nowMs)).toISOString();
    delayMinutes = Math.max(0, (nowMs - stamp) / 60_000);
  }
  const deferred = !!at;
  const date = at ? localDateOf(at) : localToday();
  const minutes = at ? localMinutesOf(at) : localNowMinutes();
  const time = minToHHMM(minutes); // heure de Brazzaville, pas celle du serveur

  /* --- 1. Le visage : comparaison avec la photo d'inscription (empreinte, jamais l'image) --- */
  const live = parseDescriptor(formData.get("faceDescriptor"));
  const reference = await getFaceReference(ts.teacherId);
  let faceDistance: number | null = null;
  let face: FaceStatus;
  if (!reference) face = "sans-reference";
  else if (!live) face = "non-verifie";
  else {
    faceDistance = Math.round(euclidean(live, reference.descriptor) * 1000) / 1000;
    face = faceVerdict(faceDistance);
  }

  const { faceStrict } = await getSchoolConfig(ts.schoolId);
  if (face === "different" && faceStrict) {
    // Aucun pointage enregistré, aucune photo conservée : seule la tentative est tracée.
    await logFaceCheck(ts.schoolId, fullName, `refus-${Date.now()}`, kind, "different", faceDistance);
    await notifyAdmin(
      ts.schoolId,
      ts.teacherId,
      "alerte",
      `Pointage refusé : visage différent (${fullName})`,
      `À ${time}, le visage filmé ne correspond pas à la photo d'inscription de ${fullName}. Aucun pointage n'a été enregistré.`,
    );
    return {
      refusedFace: true,
      face,
      faceDistance,
      error: "Le visage ne correspond pas à la photo d'inscription. Le pointage n'a pas été enregistré et la direction en a été informée.",
    };
  }

  /* --- 2. La position : dans l'enceinte de l'établissement ? --- */
  const school = await getSchool(ts.schoolId);
  let withinGeofence = true;
  let distance: number | null = null;
  let positionMissing = false;
  if (school?.lat != null && school?.lng != null) {
    if (lat != null && lng != null) {
      distance = haversineMeters({ lat, lng }, { lat: school.lat, lng: school.lng });
      withinGeofence = isWithinGeofence(distance, school.radius_m || DEFAULT_GEOFENCE_RADIUS_M);
    } else {
      // Sans position, la présence dans l'établissement ne peut pas être prouvée : pointage non validé.
      withinGeofence = false;
      positionMissing = true;
    }
  }
  // Un visage douteux ou non vérifié ne vaut pas preuve de présence.
  const identityProven = face === "verifie";
  const validated = withinGeofence && (identityProven || face === "sans-reference");

  const lateMinutes = kind === "in" ? await arrivalLateness(ts.teacherId, school?.late_tolerance_min ?? DEFAULT_LATE_TOLERANCE, { date, minutes }) : 0;
  // La position ne sert qu'au calcul ci-dessus : elle n'est pas enregistrée.
  const res = await recordAttendance({ schoolId: ts.schoolId, teacherId: ts.teacherId, kind, withinGeofence: validated, lateMinutes, at, date });
  if ("error" in res) return { error: "Enregistrement impossible. Réessayez." };

  // Photo de preuve : visible uniquement par la direction.
  const photo = formData.get("photo");
  let photoSaved = false;
  if (photo instanceof File && photo.size > 0 && photo.size <= 900_000 && photo.type === "image/jpeg") {
    photoSaved = await uploadFile(attendancePhotoPath(res.id, kind), photo, "image/jpeg");
  }
  await logFaceCheck(ts.schoolId, fullName, res.id, kind, face, faceDistance, deferred ? { delayMinutes } : undefined);

  const sens = kind === "in" ? "Arrivée" : "Départ";
  const quand = deferred ? `${sens} du ${numericDate(date)} à ${time} (pointage hors ligne)` : `${sens} pointé${kind === "in" ? "e" : ""} à ${time}`;
  if (!withinGeofence) {
    await notifyAdmin(
      ts.schoolId,
      ts.teacherId,
      "alerte",
      `Pointage non validé : ${fullName}`,
      `${quand}, ${positionMissing ? "sans position GPS" : `à ${distance} m de l'établissement`}.`,
    );
  } else if (face === "doute" || (face === "different" && !faceStrict)) {
    await notifyAdmin(
      ts.schoolId,
      ts.teacherId,
      "alerte",
      `Visage à vérifier : ${fullName}`,
      `${quand} : le visage filmé ressemble peu à la photo d'inscription. Comparez les deux photos dans les pointages.`,
    );
  } else if (face === "sans-reference") {
    // Un seul rappel par semaine, sinon la direction le recevrait à chaque pointage.
    const title = `Photo d'inscription manquante : ${fullName}`;
    if (!(await notifiedRecently(ts.schoolId, title, `${addDays(localToday(), -7)}T00:00:00.000Z`))) {
      await notifyAdmin(ts.schoolId, ts.teacherId, "info", title, `Sans photo d'inscription, les pointages de ${fullName} ne peuvent pas être vérifiés. Ajoutez-la sur sa fiche.`);
    }
  }

  revalidatePath("/espace");
  return { ok: true, kind, time, withinGeofence: validated, distance, positionMissing, lateMinutes, photoSaved, face, faceDistance, deferred };
}
