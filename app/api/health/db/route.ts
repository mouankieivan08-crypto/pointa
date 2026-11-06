import { NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Diagnostic de connexion à la base (sans détail technique exposé).
 * configured=false → variables d'environnement manquantes ; schema=ready → tables présentes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ configured: false, connected: false });
  try {
    const { error } = await supabaseAdmin().from("schools").select("id").limit(1);
    if (error) {
      const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message);
      return NextResponse.json({ configured: true, connected: true, schema: missing ? "missing" : "error" });
    }
    return NextResponse.json({ configured: true, connected: true, schema: "ready" });
  } catch {
    return NextResponse.json({ configured: true, connected: false });
  }
}
