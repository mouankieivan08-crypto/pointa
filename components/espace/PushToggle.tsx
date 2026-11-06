"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { subscribePushAction } from "@/lib/actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle() {
  const [state, setState] = useState<"unsupported" | "idle" | "on" | "loading">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.pushManager.getSubscription().then((sub) => { if (sub) setState("on"); });
    });
  }, []);

  async function enable() {
    try {
      setState("loading");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("idle"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID),
      });
      const res = await subscribePushAction(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setState(res.ok ? "on" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "on") {
    return (
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-accent-400">
        <Icon name="check" size={14} /> Rappels activés sur cet appareil
      </p>
    );
  }
  return (
    <button
      onClick={enable}
      disabled={state === "loading"}
      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-60"
    >
      <Icon name="bell" size={14} /> {state === "loading" ? "Activation…" : "Activer les rappels de cours"}
    </button>
  );
}
