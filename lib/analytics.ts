import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase/server";
import { localToday, addDays } from "./time";

/**
 * Audience du site vitrine (console plateforme).
 *
 * On enregistre le strict minimum : le type d'événement, la page, la provenance
 * et le type d'appareil. Aucune adresse IP n'est conservée : « visitor » est un
 * condensé (jour + appareil + IP) qui change chaque jour et ne permet pas de
 * remonter à quelqu'un — il sert uniquement à compter les visiteurs uniques.
 *
 * Tant que `migration-analytics.sql` n'a pas été exécuté, tout échoue en silence
 * et la console affiche « statistiques à activer ».
 */

export type EventKind = "vue" | "whatsapp" | "inscription" | "connexion";

const TABLE = "site_events";

/** La table existe-t-elle ? (mémorisé pour ne pas interroger la base à chaque appel) */
let ready: boolean | null = null;

export async function analyticsReady(): Promise<boolean> {
  if (ready !== null) return ready;
  const { error } = await supabaseAdmin().from(TABLE).select("id", { head: true, count: "exact" }).limit(1);
  ready = !error;
  return ready;
}

/** Provenance lisible à partir du référent (facebook, whatsapp, google, direct…). */
export function readableSource(referrer: string | null | undefined): string {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/facebook|fb\.me|fbclid/.test(host)) return "Facebook";
    if (/whatsapp|wa\.me/.test(host)) return "WhatsApp";
    if (/instagram/.test(host)) return "Instagram";
    if (/google/.test(host)) return "Google";
    if (/linkedin|lnkd/.test(host)) return "LinkedIn";
    if (/tiktok/.test(host)) return "TikTok";
    if (/t\.co|twitter|x\.com/.test(host)) return "X / Twitter";
    if (/youtube|youtu\.be/.test(host)) return "YouTube";
    return host;
  } catch {
    return "Direct";
  }
}

export function visitorHash(ip: string, userAgent: string): string {
  const salt = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || "pointa";
  return crypto.createHash("sha256").update(`${localToday()}|${ip}|${userAgent}|${salt}`).digest("hex").slice(0, 24);
}

export async function recordEvent(e: { kind: EventKind; path: string; referrer?: string | null; device?: string | null; visitor?: string | null }) {
  if (!(await analyticsReady())) return;
  await supabaseAdmin()
    .from(TABLE)
    .insert({
      kind: e.kind,
      path: e.path.slice(0, 200),
      referrer: readableSource(e.referrer).slice(0, 60),
      device: e.device ?? null,
      visitor: e.visitor ?? null,
    });
}

/* ================================================================
   Lecture (console)
   ================================================================ */
export interface AudienceRow {
  kind: EventKind;
  path: string;
  referrer: string | null;
  device: string | null;
  visitor: string | null;
  created_at: string;
}

export interface Audience {
  ready: boolean;
  /** Visites de la vitrine, par jour (30 derniers jours). */
  daily: { date: string; vues: number; visiteurs: number }[];
  totalViews: number;
  uniqueVisitors: number;
  whatsappClicks: number;
  signups: number;
  sources: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  pages: { path: string; count: number }[];
  today: { vues: number; visiteurs: number };
}

const EMPTY: Audience = {
  ready: false,
  daily: [],
  totalViews: 0,
  uniqueVisitors: 0,
  whatsappClicks: 0,
  signups: 0,
  sources: [],
  devices: [],
  pages: [],
  today: { vues: 0, visiteurs: 0 },
};

export async function getAudience(days = 30): Promise<Audience> {
  if (!(await analyticsReady())) return EMPTY;
  const since = `${addDays(localToday(), -(days - 1))}T00:00:00.000Z`;
  const { data } = await supabaseAdmin()
    .from(TABLE)
    .select("kind,path,referrer,device,visitor,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);

  const rows = (data as AudienceRow[] | null) ?? [];
  const views = rows.filter((r) => r.kind === "vue");
  const byDay = new Map<string, { vues: number; visiteurs: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) byDay.set(addDays(localToday(), -i), { vues: 0, visiteurs: new Set() });
  for (const r of views) {
    const d = r.created_at.slice(0, 10);
    const slot = byDay.get(d);
    if (!slot) continue;
    slot.vues++;
    if (r.visitor) slot.visiteurs.add(r.visitor);
  }

  const tally = (list: (string | null)[], fallback: string) => {
    const m = new Map<string, number>();
    for (const v of list) {
      const key = v || fallback;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };

  const today = localToday();
  const todayViews = views.filter((r) => r.created_at.slice(0, 10) === today);

  return {
    ready: true,
    daily: [...byDay.entries()].map(([date, v]) => ({ date, vues: v.vues, visiteurs: v.visiteurs.size })),
    totalViews: views.length,
    uniqueVisitors: new Set(views.map((r) => r.visitor).filter(Boolean)).size,
    whatsappClicks: rows.filter((r) => r.kind === "whatsapp").length,
    signups: rows.filter((r) => r.kind === "inscription").length,
    sources: tally(views.map((r) => r.referrer), "Direct").slice(0, 8),
    devices: tally(views.map((r) => r.device), "inconnu"),
    pages: tally(views.map((r) => r.path), "/")
      .slice(0, 8)
      .map((p) => ({ path: p.name, count: p.count })),
    today: { vues: todayViews.length, visiteurs: new Set(todayViews.map((r) => r.visitor).filter(Boolean)).size },
  };
}
