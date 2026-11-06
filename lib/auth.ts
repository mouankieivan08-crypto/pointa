import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Authentification.
 * - Direction (admin) : identifiants gérés par Supabase Auth (auth.users), appelé côté
 *   serveur avec la clé secrète. L'établissement est dans user_metadata.school_id.
 * - Enseignants : première connexion avec leur numéro, puis code personnel ; le code est
 *   stocké (haché) par Supabase Auth sur un compte technique propre à l'enseignant.
 * - Sessions : cookies httpOnly signés (HMAC-SHA256). Chaque jeton porte son type
 *   (direction / enseignant / console) : un cookie enseignant ne peut jamais servir
 *   de session direction.
 */

const COOKIE = "pointa_session";
const COOKIE_TEACHER = "pointa_teacher";
const COOKIE_CONSOLE = "pointa_console";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const CONSOLE_MAX_AGE = 60 * 60 * 12; // 12 h
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_KEY = process.env.SUPABASE_SECRET_KEY || "";
const TEACHER_EMAIL_DOMAIN = "enseignants.pointa.invalid";

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("SESSION_SECRET manquant : impossible de signer les sessions.");
  return s;
}

/* ---------------- Jetons signés ---------------- */
function hmac(data: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function signToken(payload: Record<string, unknown>) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${hmac(data)}`;
}
function readToken(token: string | undefined, kind: "a" | "t" | "c"): Record<string, unknown> | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig || !safeEqual(hmac(data), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    if (!p || p.k !== kind || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
async function setCookie(name: string, value: string, maxAge: number, path = "/") {
  (await cookies()).set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path, maxAge });
}

/* ---------------- Session DIRECTION ---------------- */
export interface Session {
  schoolId: string;
  userId: string;
  name: string;
}

export async function setSession(schoolId: string, userId: string, name = "") {
  await setCookie(COOKIE, signToken({ k: "a", sid: schoolId, uid: userId, name, exp: Date.now() + MAX_AGE * 1000 }), MAX_AGE);
}

export async function getSession(): Promise<Session | null> {
  const p = readToken((await cookies()).get(COOKIE)?.value, "a");
  if (!p || typeof p.sid !== "string" || typeof p.uid !== "string") return null;
  return { schoolId: p.sid, userId: p.uid, name: typeof p.name === "string" ? p.name : "" };
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/* ---------------- Session ENSEIGNANT ---------------- */
export interface TeacherSession {
  teacherId: string;
  schoolId: string;
  name: string;
  /** Compte technique portant le code personnel (null tant que le code n'est pas choisi). */
  authId: string | null;
  /** Première connexion : l'enseignant doit choisir son code avant de pointer. */
  mustSetCode: boolean;
}

/**
 * `authId` est comparé à chaque requête au compte courant de l'enseignant :
 * si la direction réinitialise le code, les anciennes sessions deviennent invalides.
 */
export async function setTeacherSession(teacherId: string, schoolId: string, name: string, authId: string | null) {
  await setCookie(
    COOKIE_TEACHER,
    signToken({ k: "t", tid: teacherId, sid: schoolId, name, aid: authId ?? "", exp: Date.now() + MAX_AGE * 1000 }),
    MAX_AGE,
  );
}

export async function getTeacherSession(): Promise<TeacherSession | null> {
  const p = readToken((await cookies()).get(COOKIE_TEACHER)?.value, "t");
  if (!p || typeof p.tid !== "string" || typeof p.sid !== "string") return null;
  const authId = typeof p.aid === "string" && p.aid ? p.aid : null;
  return { teacherId: p.tid, schoolId: p.sid, name: typeof p.name === "string" ? p.name : "", authId, mustSetCode: !authId };
}

export async function clearTeacherSession() {
  (await cookies()).delete(COOKIE_TEACHER);
}

/* ---------------- Console plateforme (équipe Pointa) ---------------- */
export function checkConsoleKey(input: string): boolean {
  const key = process.env.CONSOLE_KEY;
  if (!key || key.length < 16 || !input) return false;
  const h = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
  return safeEqual(h(input.trim()), h(key));
}

/**
 * Propriétaires de la plateforme : les seuls comptes qui peuvent ouvrir la console
 * avec leur email et leur mot de passe. La liste vient de CONSOLE_EMAILS
 * (adresses séparées par des virgules) ; sans elle, seule la clé CONSOLE_KEY ouvre.
 */
export function platformOwners(): string[] {
  return (process.env.CONSOLE_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformOwner(email: string): boolean {
  return platformOwners().includes(email.trim().toLowerCase());
}

export async function setConsoleSession(who = "") {
  await setCookie(COOKIE_CONSOLE, signToken({ k: "c", who, exp: Date.now() + CONSOLE_MAX_AGE * 1000 }), CONSOLE_MAX_AGE, "/console");
}

export async function isConsoleSession(): Promise<boolean> {
  return readToken((await cookies()).get(COOKIE_CONSOLE)?.value, "c") !== null;
}

/** Qui est connecté à la console (email du propriétaire, ou « clé d'accès »). */
export async function consoleIdentity(): Promise<string | null> {
  const p = readToken((await cookies()).get(COOKIE_CONSOLE)?.value, "c");
  if (!p) return null;
  return typeof p.who === "string" && p.who ? p.who : "clé d'accès";
}

export async function clearConsoleSession() {
  (await cookies()).set(COOKIE_CONSOLE, "", { path: "/console", maxAge: 0 });
}

/* ---------------- Supabase Auth (serveur) ---------------- */
async function authFetch(path: string, init: RequestInit) {
  return fetch(`${SUPA_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

/** Crée un compte direction (email confirmé). Renvoie l'id, ou une erreur lisible. */
export async function createAuthUser(email: string, password: string, metadata: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  const res = await authFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(body?.msg || body?.error_description || body?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || body?.error_code === "email_exists") return { error: "Cet email est déjà utilisé." };
    if (body?.error_code === "weak_password") return { error: "Mot de passe trop faible (6 caractères minimum)." };
    return { error: "Impossible de créer le compte." };
  }
  return { id: body.id };
}

/** Met à jour les métadonnées d'un utilisateur (ex : school_id). */
export async function updateAuthUserMetadata(userId: string, metadata: Record<string, unknown>) {
  await authFetch(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ user_metadata: metadata }) });
}

/** Change le mot de passe (ou le code) d'un utilisateur. */
export async function setAuthUserPassword(userId: string, password: string): Promise<boolean> {
  const res = await authFetch(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password }) });
  return res.ok;
}

/** Supprime un utilisateur. */
export async function deleteAuthUser(userId: string) {
  await authFetch(`/admin/users/${userId}`, { method: "DELETE" });
}

/** Vérifie email/mot de passe. Renvoie l'utilisateur (avec métadonnées) ou null. */
export async function verifyLogin(email: string, password: string): Promise<{ id: string; schoolId?: string; name?: string; role?: string } | null> {
  const res = await authFetch("/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  const user = body?.user;
  if (!user?.id) return null;
  return { id: user.id, schoolId: user.user_metadata?.school_id, name: user.user_metadata?.name, role: user.app_metadata?.role };
}

/* ---- Comptes techniques des enseignants (code personnel) ---- */
const teacherEmail = (teacherId: string) => `${teacherId}@${TEACHER_EMAIL_DOMAIN}`;

/** Crée le compte technique qui porte le code personnel de l'enseignant. */
export async function createTeacherAuthUser(teacherId: string, schoolId: string, code: string): Promise<{ id: string } | { error: string }> {
  const res = await authFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: teacherEmail(teacherId),
      password: code,
      email_confirm: true,
      app_metadata: { role: "teacher", teacher_id: teacherId, school_id: schoolId },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body?.error_code === "weak_password" ? "Code trop court (6 chiffres minimum)." : "Impossible d'enregistrer le code." };
  return { id: body.id };
}

/** Vérifie le code personnel d'un enseignant. */
export async function verifyTeacherCode(teacherId: string, code: string): Promise<boolean> {
  if (!code) return false;
  const res = await authFetch("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: teacherEmail(teacherId), password: code }),
  });
  if (!res.ok) return false;
  const body = await res.json().catch(() => null);
  return body?.user?.app_metadata?.role === "teacher" && body?.user?.app_metadata?.teacher_id === teacherId;
}

/** Comptes direction de tous les établissements (console). */
export async function listSchoolAdmins(): Promise<Map<string, { id: string; email: string; name: string; lastSignIn: string | null }[]>> {
  const out = new Map<string, { id: string; email: string; name: string; lastSignIn: string | null }[]>();
  for (let page = 1; page <= 20; page++) {
    const res = await authFetch(`/admin/users?page=${page}&per_page=200`, { method: "GET" });
    if (!res.ok) break;
    const body = await res.json().catch(() => null);
    const users = (body?.users ?? []) as {
      id: string;
      email: string;
      last_sign_in_at: string | null;
      user_metadata?: { school_id?: string; name?: string };
      app_metadata?: { role?: string };
    }[];
    for (const u of users) {
      const sid = u.user_metadata?.school_id;
      if (!sid || u.app_metadata?.role === "teacher") continue;
      const list = out.get(sid) ?? [];
      list.push({ id: u.id, email: u.email, name: u.user_metadata?.name ?? "", lastSignIn: u.last_sign_in_at });
      out.set(sid, list);
    }
    if (users.length < 200) break;
  }
  return out;
}

/** Mot de passe temporaire lisible (réinitialisation par la console). */
export function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
