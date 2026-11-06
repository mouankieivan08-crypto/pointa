import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { localToday, isIsoDate } from "./time";
import { normalizePhone, formatPhone } from "./phone";
import type { Employee, Assignment } from "./types";

/**
 * Accès aux données — TOUJOURS scopé par school_id (isolation entre établissements).
 * Utilise la clé secrète (service_role) côté serveur uniquement.
 */

const COLORS = ["#1e46c8", "#0d9488", "#7c3aed", "#d97706", "#16a34a", "#db2777", "#0284c7", "#ca8a04"];
export const BUCKET = "pointa";

/* ---------------- Établissements ---------------- */
export interface School {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  late_tolerance_min: number;
  created_at: string;
}

export async function createSchool(input: { name: string; type?: string | null; city?: string | null; email?: string | null; phone?: string | null }): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabaseAdmin()
    .from("schools")
    .insert({ name: input.name, type: input.type ?? null, city: input.city ?? null, email: input.email ?? null, phone: input.phone ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function getSchool(id: string): Promise<School | null> {
  const { data } = await supabaseAdmin().from("schools").select("*").eq("id", id).maybeSingle();
  return (data as School) ?? null;
}

export async function listAllSchools(): Promise<School[]> {
  const { data } = await supabaseAdmin().from("schools").select("*").order("created_at", { ascending: false });
  return (data as School[]) ?? [];
}

export async function updateSchoolSettings(id: string, input: { name: string; type: string | null; city: string | null; phone: string | null; lateToleranceMin: number }) {
  const { error } = await supabaseAdmin()
    .from("schools")
    .update({ name: input.name, type: input.type, city: input.city, phone: input.phone, late_tolerance_min: input.lateToleranceMin })
    .eq("id", id);
  return !error;
}

export async function updateSchoolType(id: string, type: string) {
  const { error } = await supabaseAdmin().from("schools").update({ type }).eq("id", id);
  return !error;
}

export async function updateSchoolLocation(id: string, lat: number, lng: number, radiusM: number) {
  const { error } = await supabaseAdmin().from("schools").update({ lat, lng, radius_m: radiusM }).eq("id", id);
  return !error;
}

/** Supprime un établissement et ses fichiers. Renvoie les comptes techniques des enseignants à supprimer. */
export async function purgeSchool(schoolId: string): Promise<string[]> {
  const sb = supabaseAdmin();
  const [{ data: teachers }, { data: att }] = await Promise.all([
    sb.from("teachers").select("id,user_id").eq("school_id", schoolId),
    sb.from("attendance").select("id").eq("school_id", schoolId),
  ]);
  const paths: string[] = [];
  for (const t of (teachers as { id: string }[] | null) ?? []) {
    const { data: files } = await sb.storage.from(BUCKET).list(`teachers/${t.id}`);
    for (const f of files ?? []) paths.push(`teachers/${t.id}/${f.name}`);
  }
  for (const a of (att as { id: string }[] | null) ?? []) paths.push(attendancePhotoPath(a.id, "in"), attendancePhotoPath(a.id, "out"));
  await sb.from("schools").delete().eq("id", schoolId);
  await removeFiles(paths);
  return ((teachers as { user_id: string | null }[] | null) ?? []).map((t) => t.user_id).filter((v): v is string => !!v);
}

/** Enseignants actifs par établissement (console). */
export async function teacherCountsBySchool(): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin().from("teachers").select("school_id").neq("status", "archived").limit(10000);
  const out = new Map<string, number>();
  for (const r of (data as { school_id: string }[] | null) ?? []) out.set(r.school_id, (out.get(r.school_id) ?? 0) + 1);
  return out;
}

/** Date du dernier pointage de chaque établissement (console). */
export async function lastAttendanceBySchool(schoolIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    schoolIds.map(async (id) => {
      const { data } = await supabaseAdmin().from("attendance").select("date").eq("school_id", id).order("date", { ascending: false }).limit(1);
      const d = (data as { date: string }[] | null)?.[0]?.date;
      if (d) out.set(id, d);
    }),
  );
  return out;
}

/* ---------------- Enseignants ---------------- */
interface TeacherRow {
  id: string;
  school_id: string;
  user_id: string | null;
  matricule: string | null;
  first_name: string;
  last_name: string;
  position: string;
  subject: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: "active" | "suspended" | "archived";
  color: string | null;
  base_salary: number;
  hire_date: string | null;
  created_at: string;
}

interface AssignRow {
  id: string;
  teacher_id: string;
  classe: string;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_per_week: number;
  hourly_rate: number;
}

/** Créneau hebdomadaire (jour de la semaine) — par opposition aux séances ponctuelles (date précise). */
const isWeekly = (a: { day: string | null }) => !isIsoDate(a.day);

function mapAssign(a: AssignRow): Assignment {
  return {
    id: a.id,
    classe: a.classe,
    day: a.day,
    startTime: a.start_time,
    endTime: a.end_time,
    hoursPerWeek: Number(a.hours_per_week) || 0,
    hourlyRate: Number(a.hourly_rate) || 0,
  };
}

function assignRow(teacherId: string, a: Assignment) {
  return {
    teacher_id: teacherId,
    classe: a.classe,
    day: a.day ?? null,
    start_time: a.startTime ?? null,
    end_time: a.endTime ?? null,
    hours_per_week: a.hoursPerWeek,
    hourly_rate: a.hourlyRate,
  };
}

function toEmployee(t: TeacherRow, assignments: Assignment[]): Employee {
  const weekly = assignments.reduce((s, a) => s + Number(a.hoursPerWeek || 0), 0);
  const rate = assignments.length ? Math.round(assignments.reduce((s, a) => s + a.hourlyRate, 0) / assignments.length) : 0;
  return {
    id: t.id,
    matricule: t.matricule ?? "",
    firstName: t.first_name,
    lastName: t.last_name,
    position: t.position,
    subject: t.subject ?? "",
    assignments,
    departmentId: "",
    siteId: "",
    phone: t.phone ?? "",
    email: t.email ?? "",
    hireDate: t.hire_date ?? t.created_at?.slice(0, 10) ?? localToday(),
    hourlyRate: rate,
    weeklyQuotaHours: Math.round(weekly * 100) / 100,
    hoursDoneThisMonth: 0,
    baseSalary: t.base_salary,
    scheduleStart: "07:30",
    scheduleEnd: "13:00",
    status: t.status,
    hasSmartphone: true,
    color: t.color ?? COLORS[0],
    photoUrl: t.photo_url,
    hasCode: !!t.user_id,
  };
}

const ORDER = (a: Assignment, b: Assignment) =>
  ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].indexOf(a.day ?? "") -
    ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].indexOf(b.day ?? "") ||
  (a.startTime ?? "").localeCompare(b.startTime ?? "");

export async function listTeachers(schoolId: string, opts: { includeArchived?: boolean } = {}): Promise<Employee[]> {
  const sb = supabaseAdmin();
  let q = sb.from("teachers").select("*").eq("school_id", schoolId);
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const { data: teachers } = await q.order("created_at", { ascending: true });
  const rows = (teachers as TeacherRow[]) ?? [];
  if (!rows.length) return [];
  const { data: assigns } = await sb.from("class_assignments").select("*").in("teacher_id", rows.map((r) => r.id));
  const byTeacher = new Map<string, Assignment[]>();
  for (const a of ((assigns as AssignRow[]) ?? []).filter(isWeekly)) {
    const list = byTeacher.get(a.teacher_id) ?? [];
    list.push(mapAssign(a));
    byTeacher.set(a.teacher_id, list);
  }
  return withSignedPhotos(rows.map((r) => toEmployee(r, (byTeacher.get(r.id) ?? []).sort(ORDER))));
}

export async function getTeacher(schoolId: string, id: string): Promise<Employee | null> {
  const sb = supabaseAdmin();
  const { data: t } = await sb.from("teachers").select("*").eq("school_id", schoolId).eq("id", id).maybeSingle();
  if (!t) return null;
  const { data: assigns } = await sb.from("class_assignments").select("*").eq("teacher_id", id);
  const assignments = ((assigns as AssignRow[]) ?? []).filter(isWeekly).map(mapAssign).sort(ORDER);
  const [teacher] = await withSignedPhotos([toEmployee(t as TeacherRow, assignments)]);
  return teacher;
}

export interface TeacherAuth {
  id: string;
  schoolId: string;
  userId: string | null;
  status: "active" | "suspended" | "archived";
  firstName: string;
  lastName: string;
  phone: string;
}

/** État minimal d'un enseignant (authentification, statut). */
export async function getTeacherAuth(schoolId: string, teacherId: string): Promise<TeacherAuth | null> {
  const { data } = await supabaseAdmin()
    .from("teachers")
    .select("id,school_id,user_id,status,first_name,last_name,phone")
    .eq("school_id", schoolId)
    .eq("id", teacherId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, schoolId: data.school_id, userId: data.user_id, status: data.status, firstName: data.first_name, lastName: data.last_name, phone: data.phone ?? "" };
}

export interface TeacherLoginCandidate {
  id: string;
  schoolId: string;
  schoolName: string;
  firstName: string;
  userId: string | null;
}

/** Enseignants actifs ayant ce numéro (un enseignant peut exercer dans plusieurs écoles). */
export async function findTeachersByPhone(phone: string): Promise<TeacherLoginCandidate[]> {
  const n = normalizePhone(phone);
  if (!n) return [];
  const { data } = await supabaseAdmin()
    .from("teachers")
    .select("id,school_id,first_name,user_id,schools(name)")
    .eq("status", "active")
    .in("phone", [...new Set([n, formatPhone(n)])]);
  return ((data as { id: string; school_id: string; first_name: string; user_id: string | null; schools: { name: string } | null }[] | null) ?? []).map((r) => ({
    id: r.id,
    schoolId: r.school_id,
    schoolName: r.schools?.name ?? "École",
    firstName: r.first_name,
    userId: r.user_id,
  }));
}

export async function createTeacher(
  schoolId: string,
  input: { firstName: string; lastName: string; subject: string; phone: string; email: string | null },
  assignments: Assignment[],
): Promise<{ id: string } | { error: string }> {
  const sb = supabaseAdmin();
  const { count } = await sb.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
  const n = (count ?? 0) + 1;
  const { data, error } = await sb
    .from("teachers")
    .insert({
      school_id: schoolId,
      matricule: `ENS-${String(n).padStart(3, "0")}`,
      first_name: input.firstName,
      last_name: input.lastName,
      subject: input.subject || null,
      phone: input.phone,
      email: input.email,
      color: COLORS[(n - 1) % COLORS.length],
      status: "active",
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "duplicate_phone" : error.message };
  const teacherId = data.id as string;
  if (assignments.length) {
    const { error: aErr } = await sb.from("class_assignments").insert(assignments.map((a) => assignRow(teacherId, a)));
    if (aErr) {
      await sb.from("teachers").delete().eq("id", teacherId);
      return { error: aErr.message };
    }
  }
  return { id: teacherId };
}

export async function updateTeacher(
  schoolId: string,
  id: string,
  input: { firstName: string; lastName: string; subject: string; phone: string; email: string | null },
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseAdmin()
    .from("teachers")
    .update({ first_name: input.firstName, last_name: input.lastName, subject: input.subject || null, phone: input.phone, email: input.email })
    .eq("school_id", schoolId)
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "duplicate_phone" : error.message };
  return { ok: true };
}

/** Remplace l'emploi du temps hebdomadaire (les séances ponctuelles sont conservées). */
export async function replaceWeeklyAssignments(teacherId: string, assignments: Assignment[]): Promise<boolean> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("class_assignments").select("id,day").eq("teacher_id", teacherId);
  const oldIds = ((data as { id: string; day: string | null }[] | null) ?? []).filter(isWeekly).map((r) => r.id);
  if (assignments.length) {
    const { error } = await sb.from("class_assignments").insert(assignments.map((a) => assignRow(teacherId, a)));
    if (error) return false;
  }
  if (oldIds.length) await sb.from("class_assignments").delete().in("id", oldIds);
  return true;
}

/** Emploi du temps hebdomadaire de tout l'établissement (grille, détection des conflits). */
export interface SchoolSlot {
  teacherId: string;
  teacherName: string;
  color: string;
  classe: string;
  day: string;
  start: string;
  end: string;
  rate: number;
}

export async function listSchoolSlots(schoolId: string): Promise<SchoolSlot[]> {
  const sb = supabaseAdmin();
  const { data: teachers } = await sb.from("teachers").select("id,first_name,last_name,color").eq("school_id", schoolId).neq("status", "archived");
  const rows = (teachers as { id: string; first_name: string; last_name: string; color: string | null }[] | null) ?? [];
  if (!rows.length) return [];
  const by = new Map(rows.map((r) => [r.id, r]));
  const { data } = await sb.from("class_assignments").select("*").in("teacher_id", rows.map((r) => r.id));
  return ((data as AssignRow[] | null) ?? [])
    .filter(isWeekly)
    .map((a) => {
      const t = by.get(a.teacher_id)!;
      return {
        teacherId: a.teacher_id,
        teacherName: `${t.first_name} ${t.last_name}`,
        color: t.color ?? COLORS[0],
        classe: a.classe,
        day: a.day ?? "",
        start: (a.start_time ?? "").slice(0, 5),
        end: (a.end_time ?? "").slice(0, 5),
        rate: Number(a.hourly_rate) || 0,
      };
    })
    .filter((s) => s.start && s.end);
}

export async function setTeacherStatus(schoolId: string, id: string, status: "active" | "archived") {
  await supabaseAdmin().from("teachers").update({ status }).eq("school_id", schoolId).eq("id", id);
}

export async function setTeacherUserId(teacherId: string, userId: string | null) {
  await supabaseAdmin().from("teachers").update({ user_id: userId }).eq("id", teacherId);
}

export async function updateTeacherPhoto(teacherId: string, path: string) {
  await supabaseAdmin().from("teachers").update({ photo_url: path }).eq("id", teacherId);
}

/** Supprime un enseignant, son historique et ses fichiers. */
export async function deleteTeacher(schoolId: string, teacherId: string): Promise<{ userId: string | null; name: string } | null> {
  const t = await getTeacherAuth(schoolId, teacherId);
  if (!t) return null;
  const sb = supabaseAdmin();
  const [{ data: att }, { data: files }] = await Promise.all([
    sb.from("attendance").select("id").eq("teacher_id", teacherId),
    sb.storage.from(BUCKET).list(`teachers/${teacherId}`),
  ]);
  const paths = [
    ...(files ?? []).map((f) => `teachers/${teacherId}/${f.name}`),
    ...((att as { id: string }[] | null) ?? []).flatMap((a) => [attendancePhotoPath(a.id, "in"), attendancePhotoPath(a.id, "out")]),
  ];
  await sb.from("teachers").delete().eq("school_id", schoolId).eq("id", teacherId);
  await removeFiles(paths);
  return { userId: t.userId, name: `${t.firstName} ${t.lastName}` };
}

/** Enseignants comptés dans l'abonnement (les archivés libèrent leur place). */
export async function countActiveTeachers(schoolId: string): Promise<number> {
  const { count } = await supabaseAdmin().from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).neq("status", "archived");
  return count ?? 0;
}

/* ---------------- Séances ponctuelles (remplacements, heures supplémentaires) ---------------- */
export interface OneOffSession {
  id: string;
  teacherId: string;
  date: string;
  start: string;
  end: string;
  label: string;
  rate: number;
  hours: number;
}

export async function listOneOffSessions(teacherIds: string[], from?: string, to?: string): Promise<OneOffSession[]> {
  if (!teacherIds.length) return [];
  const { data } = await supabaseAdmin()
    .from("class_assignments")
    .select("*")
    .in("teacher_id", teacherIds)
    .like("day", "____-__-__");
  return ((data as AssignRow[] | null) ?? [])
    .filter((r) => isIsoDate(r.day) && (!from || r.day! >= from) && (!to || r.day! <= to))
    .map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      date: r.day!,
      start: r.start_time ?? "",
      end: r.end_time ?? "",
      label: r.classe,
      rate: Number(r.hourly_rate) || 0,
      hours: Number(r.hours_per_week) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export async function createOneOffSession(teacherId: string, s: { date: string; start: string; end: string; label: string; rate: number; hours: number }) {
  const { error } = await supabaseAdmin()
    .from("class_assignments")
    .insert({ teacher_id: teacherId, classe: s.label, day: s.date, start_time: s.start, end_time: s.end, hours_per_week: s.hours, hourly_rate: s.rate });
  return !error;
}

/** Supprime une séance ponctuelle (uniquement si elle appartient à l'établissement). */
export async function deleteOneOffSession(schoolId: string, id: string): Promise<{ teacherId: string; label: string; date: string } | null> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("class_assignments").select("id,teacher_id,classe,day,teachers!inner(school_id)").eq("id", id).eq("teachers.school_id", schoolId).maybeSingle();
  if (!data || !isIsoDate(data.day)) return null;
  await sb.from("class_assignments").delete().eq("id", id);
  return { teacherId: data.teacher_id, label: data.classe, date: data.day };
}

/* ---------------- Stockage (privé, URL signées) ---------------- */
export async function uploadFile(path: string, body: Blob | ArrayBuffer, contentType: string): Promise<boolean> {
  const bytes = body instanceof Blob ? await body.arrayBuffer() : body;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  return !error;
}

/** Lit un petit fichier JSON du bucket (empreinte de visage). */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

export async function removeFiles(paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    await supabaseAdmin().storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

/** Remplace un fichier d'enseignant (photo, emploi du temps) quel que soit l'ancien format. */
export async function replaceTeacherFile(teacherId: string, prefix: string, body: Blob, contentType: string, ext: string): Promise<string | null> {
  const { data } = await supabaseAdmin().storage.from(BUCKET).list(`teachers/${teacherId}`);
  const old = (data ?? []).filter((f) => f.name.startsWith(`${prefix}.`)).map((f) => `teachers/${teacherId}/${f.name}`);
  const path = `teachers/${teacherId}/${prefix}.${ext}`;
  if (!(await uploadFile(path, body, contentType))) return null;
  const stale = old.filter((p) => p !== path);
  if (stale.length) await removeFiles(stale);
  return path;
}

/** URL signées (1 h par défaut) — les fichiers ne sont jamais publics. */
export async function signPaths(paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, expiresIn);
  if (error) return out;
  for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out.set(d.path, d.signedUrl);
  return out;
}

const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Chemin du fichier dans le bucket (accepte aussi les anciennes URL publiques). */
function storagePath(value?: string | null): string | null {
  if (!value) return null;
  const i = value.indexOf(PUBLIC_PREFIX);
  if (i >= 0) return decodeURIComponent(value.slice(i + PUBLIC_PREFIX.length));
  return /^https?:\/\//.test(value) ? null : value;
}

/** Photos d'inscription → URL signées valables 1 h. */
async function withSignedPhotos(list: Employee[]): Promise<Employee[]> {
  const paths = [...new Set(list.map((e) => storagePath(e.photoUrl)).filter((p): p is string => !!p))];
  if (!paths.length) return list;
  const signed = await signPaths(paths);
  return list.map((e) => {
    const p = storagePath(e.photoUrl);
    return p ? { ...e, photoUrl: signed.get(p) ?? null } : e;
  });
}

/** Document d'emploi du temps importé (photo ou PDF), s'il existe. */
export async function timetableDocUrl(teacherId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().storage.from(BUCKET).list(`teachers/${teacherId}`);
  const f = (data ?? []).find((o) => o.name.startsWith("emploi-du-temps."));
  if (!f) return null;
  const path = `teachers/${teacherId}/${f.name}`;
  return (await signPaths([path])).get(path) ?? null;
}

export const attendancePhotoPath = (attendanceId: string, kind: "in" | "out") => `attendance/${attendanceId}/${kind}.jpg`;

/** Photos de preuve prises au pointage (arrivée / départ). */
export async function attendancePhotos(attendanceIds: string[]): Promise<Map<string, { in?: string; out?: string }>> {
  const out = new Map<string, { in?: string; out?: string }>();
  if (!attendanceIds.length) return out;
  const signed = await signPaths(attendanceIds.flatMap((id) => [attendancePhotoPath(id, "in"), attendancePhotoPath(id, "out")]));
  for (const id of attendanceIds) {
    const i = signed.get(attendancePhotoPath(id, "in"));
    const o = signed.get(attendancePhotoPath(id, "out"));
    if (i || o) out.set(id, { in: i, out: o });
  }
  return out;
}

/* ---------------- Départements ---------------- */
export interface Department { id: string; name: string; count?: number }

export async function listDepartments(schoolId: string): Promise<Department[]> {
  const { data } = await supabaseAdmin().from("departments").select("id,name").eq("school_id", schoolId).order("name");
  return (data as Department[]) ?? [];
}

export async function createDepartment(schoolId: string, name: string) {
  await supabaseAdmin().from("departments").insert({ school_id: schoolId, name });
}

/* ---------------- Pointages ---------------- */
export interface AttendanceRow {
  id: string;
  teacher_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: "present" | "late" | "absent" | "off";
  late_minutes: number;
  within_geofence: boolean;
  method: string;
}

export async function listTeacherAttendance(schoolId: string, teacherId: string, limit = 15): Promise<AttendanceRow[]> {
  const { data } = await supabaseAdmin()
    .from("attendance")
    .select("*")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("date", { ascending: false })
    .limit(limit);
  return (data as AttendanceRow[]) ?? [];
}

export async function listAttendanceRange(schoolId: string, from: string, to: string): Promise<AttendanceRow[]> {
  const { data } = await supabaseAdmin()
    .from("attendance")
    .select("*")
    .eq("school_id", schoolId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .limit(10000);
  return (data as AttendanceRow[]) ?? [];
}

export async function getAttendance(schoolId: string, teacherId: string, date: string): Promise<AttendanceRow | null> {
  const { data } = await supabaseAdmin()
    .from("attendance")
    .select("*")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("date", date)
    .order("created_at")
    .limit(1);
  return ((data as AttendanceRow[] | null) ?? [])[0] ?? null;
}

/**
 * Pointage depuis le téléphone de l'enseignant. Renvoie l'id de la journée.
 * `at` / `date` permettent d'enregistrer un pointage fait **hors ligne** à l'heure
 * où il a réellement eu lieu, et non à l'heure de la synchronisation.
 */
export async function recordAttendance(input: {
  schoolId: string;
  teacherId: string;
  kind: "in" | "out";
  withinGeofence: boolean;
  lateMinutes?: number;
  at?: string;
  date?: string;
}): Promise<{ id: string } | { error: string }> {
  const sb = supabaseAdmin();
  const today = input.date ?? localToday();
  const now = input.at ?? new Date().toISOString();
  const late = input.lateMinutes ?? 0;
  // Vie privée : seule la conclusion « dans l'établissement / hors de l'établissement » est conservée, jamais la position.
  const geo = { lat: null, lng: null, method: "face" };
  const row = await getAttendance(input.schoolId, input.teacherId, today);

  if (input.kind === "in") {
    if (!row) {
      const { data, error } = await sb
        .from("attendance")
        .insert({
          school_id: input.schoolId, teacher_id: input.teacherId, date: today, check_in: now,
          status: late > 0 ? "late" : "present", late_minutes: late, within_geofence: input.withinGeofence, ...geo,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      return { id: data.id as string };
    }
    if (!row.check_in) {
      await sb.from("attendance").update({
        check_in: now, status: late > 0 ? "late" : "present", late_minutes: late,
        within_geofence: row.within_geofence && input.withinGeofence, ...geo,
      }).eq("id", row.id);
    } else {
      // Retour dans l'établissement après une sortie : la 1re arrivée est conservée,
      // le départ devra être pointé à nouveau en fin de journée.
      await sb.from("attendance").update({ check_out: null, within_geofence: row.within_geofence && input.withinGeofence }).eq("id", row.id);
    }
    return { id: row.id };
  }

  if (row) {
    // Un départ pointé hors de l'établissement invalide la journée (signalée, non payée).
    // Un pointage hors ligne synchronisé en retard ne doit pas écraser un départ plus tardif.
    const keep = row.check_out && row.check_out > now;
    await sb
      .from("attendance")
      .update({ check_out: keep ? row.check_out : now, within_geofence: row.within_geofence && input.withinGeofence })
      .eq("id", row.id);
    return { id: row.id };
  }
  // Départ sans arrivée : conservé pour traçabilité, aucune heure ne sera validée.
  const { data, error } = await sb
    .from("attendance")
    .insert({ school_id: input.schoolId, teacher_id: input.teacherId, date: today, check_out: now, status: "present", within_geofence: input.withinGeofence, ...geo })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** Correction par la direction (tracée au journal par l'appelant). */
export async function saveManualAttendance(
  schoolId: string,
  teacherId: string,
  date: string,
  input: { checkIn: string | null; checkOut: string | null; valid: boolean; lateMinutes: number },
): Promise<boolean> {
  const sb = supabaseAdmin();
  const fields = {
    check_in: input.checkIn,
    check_out: input.checkOut,
    within_geofence: input.valid,
    status: input.lateMinutes > 0 ? "late" : "present",
    late_minutes: input.lateMinutes,
    method: "manual",
  };
  const row = await getAttendance(schoolId, teacherId, date);
  const { error } = row
    ? await sb.from("attendance").update(fields).eq("id", row.id)
    : await sb.from("attendance").insert({ school_id: schoolId, teacher_id: teacherId, date, ...fields });
  return !error;
}

export async function deleteAttendance(schoolId: string, teacherId: string, date: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("attendance").delete().eq("school_id", schoolId).eq("teacher_id", teacherId).eq("date", date);
  return !error;
}

/* ---------------- Congés / absences justifiées ---------------- */
export interface LeaveRow {
  id: string;
  teacher_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "accepted" | "refused";
  created_at: string;
}

export async function listLeaves(schoolId: string, teacherId?: string): Promise<LeaveRow[]> {
  let q = supabaseAdmin().from("leaves").select("*").eq("school_id", schoolId);
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data } = await q.order("start_date", { ascending: false }).limit(300);
  return (data as LeaveRow[]) ?? [];
}

export async function createLeave(
  schoolId: string,
  teacherId: string,
  input: { type: string; start: string; end: string; reason: string | null; status: LeaveRow["status"] },
): Promise<boolean> {
  if (!(await getTeacherAuth(schoolId, teacherId))) return false;
  const { error } = await supabaseAdmin()
    .from("leaves")
    .insert({ school_id: schoolId, teacher_id: teacherId, type: input.type, start_date: input.start, end_date: input.end, reason: input.reason, status: input.status });
  return !error;
}

export async function setLeaveStatus(schoolId: string, id: string, status: "accepted" | "refused"): Promise<LeaveRow | null> {
  const { data } = await supabaseAdmin().from("leaves").update({ status }).eq("school_id", schoolId).eq("id", id).select("*").maybeSingle();
  return (data as LeaveRow) ?? null;
}

export async function deleteLeave(schoolId: string, id: string): Promise<LeaveRow | null> {
  const { data } = await supabaseAdmin().from("leaves").delete().eq("school_id", schoolId).eq("id", id).select("*").maybeSingle();
  return (data as LeaveRow) ?? null;
}

/* ---------------- Journal d'activité ---------------- */
export interface ActivityRow { id: string; actor: string | null; action: string; resource: string | null; created_at: string }

export async function logActivity(schoolId: string, actor: string, action: string, resource?: string) {
  await supabaseAdmin().from("activity_log").insert({ school_id: schoolId, actor, action, resource: resource ?? null });
}

/** Nombre d'entrées récentes pour une ressource (ex : échecs de connexion d'un enseignant). */
export async function countRecentActivity(schoolId: string, resource: string, sinceIso: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("resource", resource)
    .gte("created_at", sinceIso);
  return count ?? 0;
}

/**
 * Journal des actions de gestion. Les lignes techniques (vérifications de visage à chaque
 * pointage, échecs de connexion) sont exclues : elles sont affichées là où elles servent
 * (pointages, sécurité) et noieraient sinon les actions de la direction.
 */
export async function listActivity(schoolId: string, limit = 100): Promise<ActivityRow[]> {
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("id,actor,action,resource,created_at")
    .eq("school_id", schoolId)
    .or("resource.is.null,and(resource.not.like.face:*,resource.not.like.auth-fail:*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as ActivityRow[]) ?? [];
}

/* ---------------- Notifications (direction) ---------------- */
export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  teacher_id: string | null;
  created_at: string;
}

/** Les rappels destinés aux enseignants (cours bientôt, départ) ne concernent pas la direction. */
const ADMIN_TYPES = ["alerte", "info", "conge"];

export async function listNotifications(schoolId: string): Promise<NotificationRow[]> {
  const { data } = await supabaseAdmin().from("notifications").select("*").eq("school_id", schoolId).in("type", ADMIN_TYPES).order("created_at", { ascending: false }).limit(60);
  return (data as NotificationRow[]) ?? [];
}

export async function unreadNotificationCount(schoolId: string): Promise<number> {
  const { count } = await supabaseAdmin().from("notifications").select("id", { count: "exact", head: true }).eq("school_id", schoolId).in("type", ADMIN_TYPES).eq("read", false);
  return count ?? 0;
}

export async function markNotificationsRead(schoolId: string) {
  await supabaseAdmin().from("notifications").update({ read: true }).eq("school_id", schoolId).in("type", ADMIN_TYPES).eq("read", false);
}

export async function notifyAdmin(schoolId: string, teacherId: string | null, type: "alerte" | "info" | "conge", title: string, body: string) {
  await supabaseAdmin().from("notifications").insert({ school_id: schoolId, teacher_id: teacherId, type, title, body });
}

/**
 * Même notification déjà envoyée récemment ? Évite de répéter chaque jour le même rappel
 * (ex : « photo d'inscription manquante » à chaque pointage).
 */
export async function notifiedRecently(schoolId: string, title: string, sinceIso: string): Promise<boolean> {
  const { count } = await supabaseAdmin()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("title", title)
    .gte("created_at", sinceIso);
  return (count ?? 0) > 0;
}

export async function savePushSubscription(schoolId: string, teacherId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await supabaseAdmin()
    .from("push_subscriptions")
    .upsert({ school_id: schoolId, teacher_id: teacherId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
}
