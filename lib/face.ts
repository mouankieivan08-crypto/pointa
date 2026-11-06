import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { uploadFile, readJsonFile, removeFiles } from "./db";
import { faceVerdict, type FaceStatus } from "@/config/face";

/**
 * Empreintes de visage (côté serveur).
 *
 * L'empreinte de référence d'un enseignant est un fichier JSON privé du bucket
 * (`teachers/{id}/visage.json`) : 128 nombres, aucune image. Le résultat de chaque
 * vérification au pointage est écrit dans le journal (`face:{pointage}|{sens}`),
 * ce qui donne à la direction une trace vérifiable, sans modifier le schéma.
 */

const facePath = (teacherId: string) => `teachers/${teacherId}/visage.json`;

export interface FaceReference {
  descriptor: number[];
  at: string;
}

export async function saveFaceReference(teacherId: string, descriptor: number[]): Promise<boolean> {
  if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every((n) => Number.isFinite(n))) return false;
  const body = new Blob([JSON.stringify({ descriptor, at: new Date().toISOString() })], { type: "application/json" });
  return uploadFile(facePath(teacherId), body, "application/json");
}

export async function getFaceReference(teacherId: string): Promise<FaceReference | null> {
  const ref = await readJsonFile<FaceReference>(facePath(teacherId));
  return ref && Array.isArray(ref.descriptor) && ref.descriptor.length === 128 ? ref : null;
}

export async function removeFaceReference(teacherId: string) {
  await removeFiles([facePath(teacherId)]);
}

/** Empreintes présentes pour une liste d'enseignants (pour signaler les fiches à compléter). */
export async function teachersWithFace(teacherIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  await Promise.all(
    teacherIds.map(async (id) => {
      if (await getFaceReference(id)) out.add(id);
    }),
  );
  return out;
}

/* ---------------- Trace des vérifications ---------------- */

export interface FaceCheck {
  status: FaceStatus;
  distance: number | null;
  /** Pointage fait sans réseau, envoyé plus tard. */
  offline: boolean;
}

const faceResource = (attendanceId: string, kind: "in" | "out") => `face:${attendanceId}|${kind}`;

export async function logFaceCheck(
  schoolId: string,
  teacherName: string,
  attendanceId: string,
  kind: "in" | "out",
  status: FaceStatus,
  distance: number | null,
  offline?: { delayMinutes: number },
) {
  const sens = kind === "in" ? "arrivée" : "départ";
  const ecart = distance == null ? "" : ` (écart ${distance.toFixed(2).replace(".", ",")})`;
  const base =
    status === "verifie"
      ? `a pointé son ${sens} — visage reconnu${ecart}`
      : status === "doute"
        ? `a pointé son ${sens} — visage à vérifier${ecart}`
        : status === "different"
          ? `a tenté de pointer son ${sens} — visage différent${ecart}`
          : status === "sans-reference"
            ? `a pointé son ${sens} — aucune photo d'inscription pour comparer`
            : `a pointé son ${sens} — visage non vérifié`;
  const action = offline ? `${base} · hors ligne, reçu ${delayLabel(offline.delayMinutes)} plus tard` : base;
  await supabaseAdmin()
    .from("activity_log")
    .insert({ school_id: schoolId, actor: teacherName, action, resource: faceResource(attendanceId, kind) });
}

function delayLabel(min: number): string {
  if (min < 1) return "quelques secondes";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Résultats des vérifications pour les pointages affichés. */
export async function faceChecks(schoolId: string, attendanceIds: string[]): Promise<Map<string, { in?: FaceCheck; out?: FaceCheck }>> {
  const out = new Map<string, { in?: FaceCheck; out?: FaceCheck }>();
  if (!attendanceIds.length) return out;
  const wanted = new Set(attendanceIds);
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("action,resource,created_at")
    .eq("school_id", schoolId)
    .like("resource", "face:%")
    .order("created_at", { ascending: false })
    .limit(2000);

  for (const row of (data as { action: string; resource: string }[] | null) ?? []) {
    const [, rest] = row.resource.split("face:");
    const [id, kind] = (rest ?? "").split("|");
    if (!wanted.has(id) || (kind !== "in" && kind !== "out")) continue;
    const entry = out.get(id) ?? {};
    if (entry[kind]) continue; // on garde la vérification la plus récente
    const m = /écart (\d+),(\d+)/.exec(row.action);
    const distance = m ? Number(`${m[1]}.${m[2]}`) : null;
    const status: FaceStatus = /visage reconnu/.test(row.action)
      ? "verifie"
      : /visage à vérifier/.test(row.action)
        ? "doute"
        : /visage différent/.test(row.action)
          ? "different"
          : /aucune photo d'inscription/.test(row.action)
            ? "sans-reference"
            : "non-verifie";
    entry[kind] = { status, distance, offline: /hors ligne/.test(row.action) };
    out.set(id, entry);
  }
  return out;
}

export { faceVerdict };
