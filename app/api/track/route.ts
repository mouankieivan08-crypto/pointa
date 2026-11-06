import { NextResponse, type NextRequest } from "next/server";
import { recordEvent, visitorHash, type EventKind } from "@/lib/analytics";

/**
 * Compteur d'audience du site vitrine. Appelé par le navigateur, sans cookie :
 * l'adresse IP sert uniquement à calculer une empreinte du jour, puis elle est jetée.
 */
export const dynamic = "force-dynamic";

const KINDS: EventKind[] = ["vue", "whatsapp", "inscription", "connexion"];

export async function POST(req: NextRequest) {
  let body: { kind?: string; path?: string; referrer?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide : on compte quand même une vue
  }
  const kind = (KINDS as string[]).includes(String(body.kind)) ? (body.kind as EventKind) : "vue";
  const ua = req.headers.get("user-agent") ?? "";
  // Les robots ne sont pas des visiteurs.
  if (/bot|crawler|spider|preview|monitor|headless|curl|wget/i.test(ua)) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "0.0.0.0";
  await recordEvent({
    kind,
    path: String(body.path ?? "/"),
    referrer: body.referrer ?? req.headers.get("referer"),
    device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "ordinateur",
    visitor: visitorHash(ip, ua),
  });
  return NextResponse.json({ ok: true });
}
