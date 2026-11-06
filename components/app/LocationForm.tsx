"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { saveLocationAction, type ActionState } from "@/lib/actions";

const RADII = [30, 50, 100, 150, 200];

export function LocationForm({ initial }: { initial: { lat: number | null; lng: number | null; radius: number } }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveLocationAction, {});
  const [lat, setLat] = useState<string>(initial.lat != null ? String(initial.lat) : "");
  const [lng, setLng] = useState<string>(initial.lng != null ? String(initial.lng) : "");
  const [radius, setRadius] = useState<number>(initial.radius || 100);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  function useMyPosition() {
    if (!("geolocation" in navigator)) { setGeoState("error"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setAccuracy(Math.round(p.coords.accuracy));
        setGeoState("ok");
      },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const hasCoords = lat !== "" && lng !== "";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <input type="hidden" name="radius" value={radius} />

      <Card>
        <h3 className="font-bold text-foreground">Position de l'établissement</h3>
        <p className="mt-1 text-sm text-muted">Idéalement, faites-le <strong>depuis l'établissement</strong> pour une position précise. Les enseignants ne pourront pointer que dans le rayon défini autour de ce point.</p>

        <Button type="button" variant="secondary" className="mt-4" onClick={useMyPosition} disabled={geoState === "loading"}>
          <Icon name="pin" size={18} /> {geoState === "loading" ? "Localisation…" : "Utiliser ma position actuelle"}
        </Button>
        {geoState === "ok" && <p className="mt-2 text-sm font-medium text-present">✓ Position captée{accuracy != null ? ` (précision ~${accuracy} m)` : ""}.</p>}
        {geoState === "error" && <p className="mt-2 text-sm font-medium text-absent">Impossible d'obtenir la position (autorisez la géolocalisation, ou saisissez les coordonnées manuellement).</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Latitude</span>
            <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-4.2634" className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Longitude</span>
            <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="15.2429" className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </label>
        </div>

        <div className="mt-5">
          <span className="mb-2 block text-sm font-medium text-foreground">Rayon autorisé autour de l'établissement</span>
          <div className="flex flex-wrap gap-2">
            {RADII.map((r) => (
              <button key={r} type="button" onClick={() => setRadius(r)} className={`rounded-xl border px-4 py-2 text-sm font-medium ${radius === r ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border bg-surface text-foreground hover:bg-surface-2"}`}>{r} m</button>
            ))}
          </div>
        </div>
      </Card>

      {hasCoords && (
        <Card>
          <p className="text-sm font-semibold text-foreground">Aperçu de la carte</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Carte de l'établissement"
              src={`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=640x260&markers=${lat},${lng},lightblue1`}
              className="h-[200px] w-full object-cover"
            />
          </div>
          <p className="mt-2 text-xs text-muted">{lat}, {lng} · rayon {radius} m</p>
        </Card>
      )}

      {state.error && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !hasCoords}><Icon name="check" size={18} /> {pending ? "Enregistrement…" : "Valider la localisation"}</Button>
      </div>
    </form>
  );
}
