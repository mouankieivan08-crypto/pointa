"use client";

/**
 * File d'attente des pointages faits sans réseau.
 *
 * Le pointage est enregistré sur le téléphone (IndexedDB : photo comprise), avec
 * l'heure réelle à laquelle il a eu lieu. Dès que la connexion revient, il part vers
 * le serveur — qui refait lui-même la vérification du visage et de la position.
 * Rien n'est validé sur le téléphone : il ne fait que conserver la preuve.
 */

const DB = "pointa";
const STORE = "pointages";
const VERSION = 1;

export interface QueuedPunch {
  id: string;
  kind: "in" | "out";
  /** Moment réel du pointage (ISO, horloge du téléphone). */
  at: string;
  lat: number | null;
  lng: number | null;
  descriptor: number[] | null;
  photo: Blob | null;
  /** Verdict calculé sur l'appareil, affiché à l'enseignant ; le serveur tranche. */
  localFace: string | null;
  tries: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponible"));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function enqueue(p: Omit<QueuedPunch, "id" | "tries">): Promise<string> {
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;
  await tx("readwrite", (s) => s.put({ ...p, id, tries: 0 }));
  return id;
}

export async function listQueue(): Promise<QueuedPunch[]> {
  try {
    const all = await tx<QueuedPunch[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedPunch[]>);
    return all.sort((a, b) => a.at.localeCompare(b.at));
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string) {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* rien à faire : la file sera rejouée au prochain passage */
  }
}

export async function markTried(p: QueuedPunch) {
  try {
    await tx("readwrite", (s) => s.put({ ...p, tries: p.tries + 1 }));
  } catch {
    /* ignoré */
  }
}

export async function queueCount(): Promise<number> {
  return (await listQueue()).length;
}
