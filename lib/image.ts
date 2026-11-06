/**
 * Outils navigateur pour les images (photos d'enseignants, emplois du temps, photos de pointage) :
 * on réduit la taille AVANT l'envoi — plus rapide sur les réseaux mobiles et sous la limite d'envoi.
 */
export async function compressImage(file: File | Blob, maxSide: number, quality = 0.8, name = "image.jpg"): Promise<File> {
  const original = file instanceof File ? file : new File([file], name, { type: file.type });
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return original; // format non lisible par le navigateur : envoyé tel quel (le serveur vérifie)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return original;
  const base = (original.name || name).replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Place un fichier (déjà traité) dans un <input type="file"> pour qu'il parte avec le formulaire. */
export function setInputFile(input: HTMLInputElement | null, file: File | null) {
  if (!input) return;
  const dt = new DataTransfer();
  if (file) dt.items.add(file);
  input.files = dt.files;
}

/** Capture l'image courante d'une vidéo (caméra) en JPEG compressé. */
export async function captureVideoFrame(video: HTMLVideoElement, maxSide = 480, quality = 0.7): Promise<File | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob ? new File([blob], "pointage.jpg", { type: "image/jpeg" }) : null;
}
