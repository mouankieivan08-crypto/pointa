import { NextResponse } from "next/server";
import crypto from "crypto";
import { runReminders } from "@/lib/notify";

/**
 * Déclenché par un cron externe (cron-job.org) toutes les 5–10 min.
 * Protégé par CRON_SECRET (?secret=... ou en-tête x-cron-secret). Fermé si le secret n'est pas configuré.
 * Vercel (plan gratuit) ne permettant qu'un cron par jour, on utilise un cron externe.
 */
export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const provided = new URL(req.url).searchParams.get("secret") || req.headers.get("x-cron-secret") || "";
  if (!sameSecret(provided, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await runReminders();
    return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
