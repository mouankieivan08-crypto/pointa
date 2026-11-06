"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { punchAction, teacherLogoutAction, type PunchResult } from "@/lib/actions";
import { captureVideoFrame } from "@/lib/image";
import { describeVideo, ensureModels, preloadModels, faceDistance as distanceBetween } from "@/lib/face-client";
import { FACE_LABEL, faceVerdict } from "@/config/face";
import { enqueue, listQueue, removeFromQueue, markTried, type QueuedPunch } from "@/lib/offline-queue";
import { PushToggle } from "@/components/espace/PushToggle";
import { TeacherSetCode } from "@/components/espace/TeacherSetCode";
import { LeaveRequest } from "@/components/espace/LeaveRequest";

type Phase = "home" | "scanning" | "success" | "code" | "leave";

/** Relevé personnel : mêmes calculs que ceux de la direction (transparence). */
export interface TeacherReport {
  monthLabel: string;
  verifiedHours: string;
  pay: string;
  lateCount: number;
  absences: number;
  missingDepartures: number;
  history: { id: string; day: string; times: string; status: string; tone: "ok" | "warn" | "bad" }[];
}

const TONE: Record<"ok" | "warn" | "bad", string> = { ok: "#86efac", warn: "#fcd34d", bad: "#fca5a5" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Distance en mètres entre deux points (même formule que le serveur). */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function TeacherPunch({
  firstName,
  subject,
  schoolName,
  today,
  todayLabel,
  report,
  schedule,
  leaves,
  codeChanged,
  schoolLocated,
  faceReference,
  school,
}: {
  firstName: string;
  subject: string;
  schoolName: string;
  today: string;
  todayLabel: string;
  report: TeacherReport;
  schedule: { classe: string; start: string; end: string; oneOff: boolean }[];
  leaves: { id: string; label: string; status: string }[];
  codeChanged: boolean;
  schoolLocated: boolean;
  /** Empreinte de référence, pour dire tout de suite à l'enseignant si le visage colle, même sans réseau. */
  faceReference: number[] | null;
  /** Position de l'établissement, pour vérifier la zone hors ligne (le serveur revérifie). */
  school: { lat: number; lng: number; radius: number } | null;
}) {
  const [phase, setPhase] = useState<Phase>("home");
  const [result, setResult] = useState<PunchResult | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [step, setStep] = useState("");
  const [modelsReady, setModelsReady] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<QueuedPunch[]>([]);
  const [syncing, setSyncing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La reconnaissance se télécharge une fois puis reste en cache : le 1er pointage
  // du téléphone prépare le terrain pendant que l'enseignant regarde ses cours.
  useEffect(() => {
    // Le service worker garde les modèles en cache : les pointages suivants n'attendent plus.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    preloadModels();
    let alive = true;
    ensureModels().then((ok) => alive && setModelsReady(ok));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (backTimer.current) clearTimeout(backTimer.current);
    },
    [],
  );

  /* --- Réseau : on envoie la file d'attente dès que la connexion revient --- */
  useEffect(() => {
    const refresh = () => listQueue().then(setPending);
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    void refresh();
    if (navigator.onLine) void flush();
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Envoie au serveur les pointages gardés sur le téléphone. */
  async function flush() {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      for (const p of await listQueue()) {
        const fd = new FormData();
        fd.set("kind", p.kind);
        fd.set("at", p.at);
        if (p.lat != null && p.lng != null) {
          fd.set("lat", String(p.lat));
          fd.set("lng", String(p.lng));
        }
        if (p.descriptor) fd.set("faceDescriptor", JSON.stringify(p.descriptor));
        if (p.photo) fd.set("photo", new File([p.photo], "pointage.jpg", { type: "image/jpeg" }));
        try {
          const res = await punchAction(fd);
          // Refusé (visage, délai dépassé) : inutile de réessayer, on retire de la file.
          if (res.ok || res.refusedFace || /hors ligne|avance/.test(res.error ?? "")) await removeFromQueue(p.id);
          else if (p.tries >= 5) await removeFromQueue(p.id);
          else await markTried(p);
        } catch {
          break; // la connexion est repartie : on réessaiera
        }
      }
    } finally {
      setPending(await listQueue());
      setSyncing(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }

  async function startCamera(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      setCamReady(true);
      return true;
    } catch {
      return false;
    }
  }

  function getPos(): Promise<{ lat: number | null; lng: number | null }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }

  async function punch(kind: "in" | "out") {
    if (phase === "scanning") return;
    if (backTimer.current) clearTimeout(backTimer.current);
    setPhase("scanning");
    setStep("Ouverture de la caméra…");
    const posPromise = getPos();
    const cam = await startCamera();
    if (!cam) {
      stopCamera();
      setResult({ error: "La caméra est nécessaire pour pointer. Autorisez l'accès à la caméra puis réessayez." });
      setPhase("success");
      return;
    }
    // Laisse la caméra régler la luminosité avant de regarder le visage.
    await sleep(900);

    setStep("Vérification du visage…");
    const face = await describeVideo(videoRef.current!);
    const photo = videoRef.current ? await captureVideoFrame(videoRef.current) : null;
    setStep("Vérification de la position…");
    const pos = await posPromise;
    stopCamera();

    const fd = new FormData();
    fd.set("kind", kind);
    if (pos.lat != null && pos.lng != null) {
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
    }
    if (photo) fd.set("photo", photo);
    if ("descriptor" in face) fd.set("faceDescriptor", JSON.stringify(face.descriptor));

    const at = new Date().toISOString();
    const descriptor = "descriptor" in face ? face.descriptor : null;
    fd.set("at", at);

    // Sans réseau : on garde le pointage sur le téléphone (photo comprise) et on l'envoie plus tard.
    if (!navigator.onLine) {
      setStep("Pas de réseau : enregistrement sur le téléphone…");
      const res = await keepForLater({ kind, at, pos, photo, descriptor });
      setResult(res);
      setPhase("success");
      setStep("");
      backTimer.current = setTimeout(() => setPhase("home"), 9000);
      return;
    }

    setStep("Enregistrement…");
    let res: PunchResult;
    try {
      res = await punchAction(fd);
    } catch {
      // Le réseau a lâché pendant l'envoi : même traitement que hors ligne.
      res = await keepForLater({ kind, at, pos, photo, descriptor });
    }
    setResult(res);
    setPhase("success");
    setStep("");
    if (!res.error) backTimer.current = setTimeout(() => setPhase("home"), 9000);
  }

  /**
   * Met le pointage de côté. Le verdict affiché est calculé sur l'appareil pour
   * rassurer l'enseignant ; c'est le serveur qui validera vraiment à l'envoi.
   */
  async function keepForLater(p: {
    kind: "in" | "out";
    at: string;
    pos: { lat: number | null; lng: number | null };
    photo: File | null;
    descriptor: number[] | null;
  }): Promise<PunchResult> {
    let localFace: PunchResult["face"] = faceReference ? "non-verifie" : "sans-reference";
    let dist: number | null = null;
    if (faceReference && p.descriptor) {
      dist = distanceBetween(p.descriptor, faceReference);
      localFace = faceVerdict(dist);
    }
    let within = true;
    let metres: number | null = null;
    if (school) {
      if (p.pos.lat != null && p.pos.lng != null) {
        metres = Math.round(haversine(p.pos.lat, p.pos.lng, school.lat, school.lng));
        within = metres <= school.radius;
      } else within = false;
    }
    try {
      await enqueue({ kind: p.kind, at: p.at, lat: p.pos.lat, lng: p.pos.lng, descriptor: p.descriptor, photo: p.photo, localFace: localFace ?? null });
      setPending(await listQueue());
    } catch {
      return { error: "Impossible d'enregistrer le pointage sur ce téléphone. Réessayez une fois le réseau revenu." };
    }
    return {
      ok: true,
      queued: true,
      kind: p.kind,
      time: new Date(p.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      withinGeofence: within,
      distance: metres,
      positionMissing: p.pos.lat == null,
      face: localFace,
      faceDistance: dist,
      photoSaved: !!p.photo,
    };
  }

  return (
    <div className="pointa-gradient fixed inset-0 overflow-y-auto overscroll-contain text-white">
      {/* Vidéo toujours présente (masquée) pour que la caméra démarre sans attendre l'affichage */}
      <video ref={videoRef} muted playsInline className="hidden" />

      <header className="sticky top-0 z-10 flex items-center justify-between bg-brand-800/60 px-5 py-4 backdrop-blur">
        <Link href="/"><Logo variant="light" size={22} /></Link>
        <form action={teacherLogoutAction}>
          <button type="submit" className="flex items-center gap-1.5 text-sm text-white/75 hover:text-white" aria-label="Déconnexion">
            <Icon name="logout" size={18} />
          </button>
        </form>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col items-center px-5 pb-12 pt-4 text-center">
        {phase === "home" && (
          <>
            {codeChanged && <p className="mb-4 w-full rounded-xl bg-white/15 px-4 py-2.5 text-sm">Code enregistré. Utilisez-le à chaque connexion.</p>}
            <OfflineBar online={online} pending={pending.length} syncing={syncing} onSend={flush} />
            <p className="text-sm capitalize text-white/70">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-extrabold">Bonjour {firstName}</h1>
            <p className="mt-1 text-white/70">{subject} · {schoolName}</p>

            <section className="mt-6 w-full rounded-2xl bg-white/10 p-4 text-left">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">Mes cours aujourd&apos;hui</h2>
              {schedule.length === 0 ? (
                <p className="mt-2 text-sm text-white/80">Pas de cours prévu aujourd&apos;hui.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {schedule.map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold tabular-nums">{s.start} – {s.end}</span>
                      <span className="truncate text-right text-white/85">{s.classe}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-6 flex w-full flex-col gap-3">
              <button onClick={() => punch("in")} className="h-16 rounded-2xl bg-white text-lg font-bold text-brand-700 shadow-lg transition active:scale-[0.99]">
                Pointer l&apos;arrivée
              </button>
              <button onClick={() => punch("out")} className="h-16 rounded-2xl border border-white/40 text-lg font-bold text-white transition active:scale-[0.99] hover:bg-white/10">
                Pointer le départ
              </button>
            </div>
            <p className="mt-4 flex items-start justify-center gap-1.5 text-xs text-white/65">
              <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
              Votre visage est comparé à votre photo d&apos;inscription sur votre téléphone. Position vérifiée au seul moment du pointage, jamais conservée. Une photo est prise,
              visible uniquement par la direction.
            </p>
            {modelsReady === null && <p className="mt-2 text-xs text-white/55">Préparation de la reconnaissance du visage (une seule fois)…</p>}
            {modelsReady === false && (
              <p className="mt-2 text-xs text-amber-200">
                La reconnaissance du visage n&apos;a pas pu se charger. Vous pouvez pointer : la photo servira de preuve, la direction vérifiera.
              </p>
            )}
            {!schoolLocated && <p className="mt-2 text-xs text-amber-200">La direction n&apos;a pas encore validé la position de l&apos;établissement.</p>}
            <PushToggle />

            <Report report={report} />

            {leaves.length > 0 && (
              <section className="mt-4 w-full rounded-2xl bg-white/10 p-4 text-left">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">Mes demandes d&apos;absence</h2>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {leaves.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3">
                      <span className="text-white/85">{l.label}</span>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: l.status === "accepted" ? TONE.ok : l.status === "refused" ? TONE.bad : TONE.warn }}>
                        {l.status === "accepted" ? "Acceptée" : l.status === "refused" ? "Refusée" : "En attente"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <button onClick={() => setPhase("leave")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15">
                <Icon name="leaf" size={16} /> Signaler une absence
              </button>
              <button onClick={() => setPhase("code")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15">
                <Icon name="key" size={16} /> Changer mon code
              </button>
            </div>
          </>
        )}

        {phase === "scanning" && (
          <div className="pt-8">
            <h2 className="text-xl font-bold">Pointage en cours…</h2>
            <div className="relative mx-auto mt-6 flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/5">
              {camReady ? <LivePreview stream={streamRef.current} /> : <Icon name="camera" size={64} className="text-white/80" />}
            </div>
            <p className="mt-6 font-medium text-white">{step || "Un instant…"}</p>
            <p className="mt-1 text-sm text-white/65">Regardez la caméra bien en face, dans un endroit éclairé.</p>
          </div>
        )}

        {phase === "success" && result && (
          <div className="w-full pt-8">
            {result.error ? (
              <>
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${result.refusedFace ? "bg-red-500/30" : "bg-white/15"}`}>
                  <Icon name="alert" size={28} />
                </div>
                <h2 className="mt-4 text-xl font-bold">{result.refusedFace ? "Pointage refusé" : "Pointage non enregistré"}</h2>
                <p className="mt-2 text-white/85">{result.error}</p>
                {result.refusedFace && (
                  <p className="mx-auto mt-3 max-w-xs rounded-xl bg-white/10 px-4 py-3 text-xs text-white/75">
                    Si c&apos;est bien vous : mettez-vous face à la caméra, dans un endroit éclairé, sans casquette ni lunettes de soleil. Si le problème persiste, demandez à la
                    direction de reprendre votre photo d&apos;inscription.
                  </p>
                )}
                <button onClick={() => setPhase("home")} className="mt-6 h-12 w-full max-w-xs rounded-xl bg-white text-sm font-bold text-brand-700">Retour</button>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-brand-700">
                  <Icon name={result.queued ? "clock" : "check"} size={36} />
                </div>
                <h2 className="mt-4 text-2xl font-extrabold">
                  {result.queued
                    ? result.kind === "in"
                      ? "Arrivée enregistrée hors ligne"
                      : "Départ enregistré hors ligne"
                    : result.kind === "in"
                      ? "Arrivée enregistrée"
                      : "Départ enregistré"}
                </h2>
                {result.queued && (
                  <p className="mx-auto mt-3 max-w-xs rounded-xl bg-white/10 px-4 py-3 text-sm text-white/85">
                    L&apos;heure exacte ({result.time}) est gardée sur votre téléphone. Le pointage partira tout seul dès que vous aurez du réseau — la direction verra
                    l&apos;heure réelle, pas celle de l&apos;envoi.
                  </p>
                )}
                <div className="mx-auto mt-5 w-full max-w-xs space-y-2 rounded-2xl bg-white/10 p-5 text-sm text-white/85">
                  <Row label="Heure" value={result.time || "—"} />
                  {!!result.lateMinutes && <Row label="Retard" value={`${result.lateMinutes} min`} tone="warn" />}
                  <Row
                    label="Position"
                    value={result.positionMissing || result.distance == null ? (result.withinGeofence ? "Non vérifiée" : "Non disponible") : result.withinGeofence ? `Dans l'établissement · ${result.distance} m` : `Hors zone · ${result.distance} m`}
                    tone={result.withinGeofence ? "ok" : "warn"}
                  />
                  <Row
                    label="Visage"
                    value={result.face ? FACE_LABEL[result.face] : "Non vérifié"}
                    tone={result.face === "verifie" ? "ok" : result.face === "doute" ? "warn" : undefined}
                  />
                  <Row label="Photo" value={result.photoSaved ? "Enregistrée" : "Non prise"} />
                  {result.face === "doute" && (
                    <p className="mt-2 rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-white">
                      Le visage ressemble peu à votre photo d&apos;inscription : la direction vérifiera les deux photos.
                    </p>
                  )}
                  {result.face === "non-verifie" && (
                    <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80">
                      La vérification du visage n&apos;a pas pu se faire (visage non détecté ou connexion trop lente). La photo reste la preuve du pointage.
                    </p>
                  )}
                  {!result.withinGeofence && (
                    <p className="mt-2 rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-white">
                      {result.positionMissing
                        ? "Activez la localisation de votre téléphone puis pointez de nouveau : sans position, le pointage n'est pas validé."
                        : "Vous êtes hors de l'enceinte de l'établissement : ce pointage est enregistré mais n'est pas validé."}
                    </p>
                  )}
                </div>
                <button onClick={() => setPhase("home")} className="mt-6 h-12 w-full max-w-xs rounded-xl bg-white/15 text-sm font-semibold">Retour à l&apos;accueil</button>
              </>
            )}
          </div>
        )}

        {phase === "code" && (
          <div className="flex w-full justify-center pt-4">
            <TeacherSetCode firstName={firstName} mode="change" onCancel={() => setPhase("home")} />
          </div>
        )}
        {phase === "leave" && (
          <div className="flex w-full justify-center pt-4">
            <LeaveRequest today={today} onDone={() => setPhase("home")} />
          </div>
        )}
      </main>
    </div>
  );
}

/** Bandeau réseau : état de la connexion et pointages encore sur le téléphone. */
function OfflineBar({ online, pending, syncing, onSend }: { online: boolean; pending: number; syncing: boolean; onSend: () => void }) {
  if (online && pending === 0) return null;
  return (
    <div className={`mb-4 w-full rounded-xl px-4 py-3 text-left text-sm ${online ? "bg-white/15" : "bg-amber-500/25"}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon name={online ? "upload" : "alert"} size={16} />
        {online ? "Envoi des pointages en attente" : "Pas de réseau — vous pouvez quand même pointer"}
      </p>
      <p className="mt-1 text-white/85">
        {pending === 0
          ? "Votre pointage sera enregistré sur ce téléphone et envoyé dès le retour du réseau."
          : `${pending} pointage${pending > 1 ? "s" : ""} gardé${pending > 1 ? "s" : ""} sur ce téléphone${online ? "" : " — ils partiront dès le retour du réseau"}.`}
      </p>
      {online && pending > 0 && (
        <button onClick={onSend} disabled={syncing} className="mt-2 h-9 rounded-lg bg-white px-3 text-xs font-bold text-brand-700 disabled:opacity-60">
          {syncing ? "Envoi…" : "Envoyer maintenant"}
        </button>
      )}
    </div>
  );
}

/** Aperçu caméra pendant le pointage (même flux que la vidéo masquée). */
function LivePreview({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} muted playsInline className="h-full w-full scale-x-[-1] object-cover" />;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/60">{label}</span>
      <span className={`font-semibold ${tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-green-300" : ""}`}>{value}</span>
    </div>
  );
}

function Report({ report }: { report: TeacherReport }) {
  return (
    <section className="mt-6 w-full rounded-2xl bg-white/10 p-5 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Mon relevé</h2>
        <span className="text-xs capitalize text-white/60">{report.monthLabel}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <ReportStat label="Heures validées" value={report.verifiedHours} />
        <ReportStat label="Montant calculé" value={`${report.pay} FCFA`} />
        <ReportStat label="Retards" value={String(report.lateCount)} />
        <ReportStat label="Absences" value={String(report.absences)} />
      </div>
      {report.missingDepartures > 0 && (
        <p className="mt-3 text-xs" style={{ color: TONE.warn }}>
          {report.missingDepartures} départ(s) non pointé(s) : ces journées ne sont pas comptées. Signalez-le à la direction.
        </p>
      )}
      {report.history.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10 text-xs">
          {report.history.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2">
              <span className="w-20 shrink-0 text-white/60">{h.day}</span>
              <span className="flex-1 text-white/85">{h.times}</span>
              <span className="text-right font-medium" style={{ color: TONE[h.tone] }}>{h.status}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[0.7rem] leading-relaxed text-white/55">
        Ce relevé est identique à celui de la direction. Le montant est calculé automatiquement (heures validées × taux) puis confirmé par l&apos;établissement.
      </p>
    </section>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.7rem] text-white/60">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
