/**
 * Reconnaissance du visage côté navigateur.
 *
 * Les modèles (~6,8 Mo) sont téléchargés une seule fois puis gardés en cache par le
 * navigateur : la 2e utilisation est immédiate, même hors ligne. Rien n'est envoyé à
 * un service extérieur — tout le calcul se fait sur l'appareil.
 */
import { FACE_INPUT_SIZE, FACE_MODEL_URI, FACE_SCORE_MIN } from "@/config/face";

type FaceApi = typeof import("@vladmandic/face-api");

export type FaceFailure = "modeles" | "aucun-visage" | "plusieurs-visages" | "image";

export interface FaceResult {
  descriptor: number[];
  score: number;
}

let api: Promise<FaceApi> | null = null;
let ready: Promise<boolean> | null = null;

async function load(): Promise<FaceApi> {
  if (!api) api = import("@vladmandic/face-api");
  return api;
}

/** Charge les modèles (une seule fois). Renvoie false si le réseau ou l'appareil ne suit pas. */
export function ensureModels(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        const faceapi = await load();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URI),
          faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URI),
          faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URI),
        ]);
        return true;
      } catch {
        ready = null; // permet un nouvel essai plus tard (réseau coupé au 1er chargement)
        return false;
      }
    })();
  }
  return ready;
}

/** Démarre le téléchargement des modèles en arrière-plan, sans bloquer l'écran. */
export function preloadModels() {
  if (typeof window !== "undefined") setTimeout(() => void ensureModels(), 800);
}

async function describe(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<FaceResult | { error: FaceFailure }> {
  const faceapi = await load();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_INPUT_SIZE, scoreThreshold: FACE_SCORE_MIN });
  const all = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors();
  if (all.length === 0) return { error: "aucun-visage" };
  if (all.length > 1) return { error: "plusieurs-visages" };
  return { descriptor: Array.from(all[0].descriptor), score: all[0].detection.score };
}

/** Empreinte du visage d'une photo (inscription). */
export async function describeFile(file: File | Blob): Promise<FaceResult | { error: FaceFailure }> {
  if (!(await ensureModels())) return { error: "modeles" };
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await describe(img);
  } catch {
    return { error: "image" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Empreinte du visage filmé : plusieurs essais pendant que la personne se place,
 * on garde la meilleure détection (personne ne tient parfaitement immobile).
 */
export async function describeVideo(video: HTMLVideoElement, attempts = 6, gapMs = 350): Promise<FaceResult | { error: FaceFailure }> {
  if (!(await ensureModels())) return { error: "modeles" };
  let best: FaceResult | null = null;
  let last: FaceFailure = "aucun-visage";
  for (let i = 0; i < attempts; i++) {
    if (!video.videoWidth) {
      await new Promise((r) => setTimeout(r, gapMs));
      continue;
    }
    const res = await describe(video).catch(() => ({ error: "image" as FaceFailure }));
    if ("descriptor" in res) {
      if (!best || res.score > best.score) best = res;
      if (res.score > 0.85) break; // détection franche : inutile d'insister
    } else {
      last = res.error;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return best ?? { error: last };
}

/** Écart entre deux empreintes (0 = identique). */
export function faceDistance(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export const FACE_FAILURE_MESSAGE: Record<FaceFailure, string> = {
  modeles: "La vérification du visage n'a pas pu se charger (connexion trop lente).",
  "aucun-visage": "Aucun visage détecté. Mettez-vous face à la caméra, dans un endroit éclairé.",
  "plusieurs-visages": "Plusieurs visages détectés. Pointez seul devant la caméra.",
  image: "Image illisible. Réessayez.",
};
