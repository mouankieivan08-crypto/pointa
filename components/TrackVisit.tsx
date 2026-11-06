"use client";

import { useEffect } from "react";

/**
 * Compte une visite du site vitrine (une seule fois par onglet) et les clics
 * vers WhatsApp. Aucun cookie, aucun traceur extérieur : un simple appel à
 * notre propre serveur.
 */
export function TrackVisit({ path = "/" }: { path?: string }) {
  useEffect(() => {
    const key = `pointa-vue:${path}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // navigation privée : on compte quand même
    }
    const body = JSON.stringify({ kind: "vue", path, referrer: document.referrer || null });
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [path]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement | null)?.closest?.("a");
      const href = link?.getAttribute("href") ?? "";
      if (!/wa\.me|whatsapp/i.test(href)) return;
      const body = JSON.stringify({ kind: "whatsapp", path, referrer: document.referrer || null });
      fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [path]);

  return null;
}
