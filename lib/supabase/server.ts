import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase CÔTÉ SERVEUR uniquement.
 * Utilise la clé secrète (service_role) — elle contourne la RLS et ne doit
 * JAMAIS être exposée au navigateur. Le module `server-only` garantit qu'un
 * import accidentel côté client casse la compilation.
 *
 * NB : la clé publishable fournie renvoyait 401 ; tout l'accès data passe donc
 * par le serveur avec cette clé secrète (pattern plus sûr : aucune clé au client).
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY manquants.");
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/** Vrai si les variables d'environnement Supabase sont présentes. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
