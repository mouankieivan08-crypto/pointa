import "server-only";
import { headers } from "next/headers";

/** Adresse publique de l'application (pour les liens envoyés aux enseignants). */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "pointa-tawny.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
