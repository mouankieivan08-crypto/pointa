"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/config/money";
import { WEEKS_PER_MONTH } from "@/config/rules";
import { compressImage } from "@/lib/image";
import { describeFile, preloadModels, FACE_FAILURE_MESSAGE } from "@/lib/face-client";
import { useActionForm } from "@/lib/form-client";
import type { ActionState } from "@/lib/actions";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const SHORT: Record<string, string> = { Lundi: "Lun", Mardi: "Mar", Mercredi: "Mer", Jeudi: "Jeu", Vendredi: "Ven", Samedi: "Sam" };
const SUBJECTS = ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Anglais", "Espagnol", "Histoire-Géographie", "Philosophie", "Informatique", "Éducation physique", "Comptabilité", "Coiffure / Esthétique", "Couture", "Mécanique"];

/** Vocabulaire adapté à la structure (classe / promotion / groupe, enseignant / formateur). */
export interface FormVocab {
  staffOne: string;
  groupOne: string;
  groupMany: string;
  example: string;
}
const DEFAULT_VOCAB: FormVocab = { staffOne: "enseignant", groupOne: "classe", groupMany: "Classes", example: "6e A" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface SlotInput {
  classe: string;
  day: string;
  start: string;
  end: string;
  rate: number;
}

export interface TeacherFormInitial {
  firstName: string;
  lastName: string;
  subject: string;
  phone: string;
  email: string;
  photoUrl: string | null;
  hasFace?: boolean;
  slots: SlotInput[];
}

interface Session {
  id: number;
  day: string;
  start: string;
  end: string;
}
interface Course {
  id: number;
  classe: string;
  rate: number;
  sessions: Session[];
}

function toMin(t: string) {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durationH(start: string, end: string) {
  const d = (toMin(end) - toMin(start)) / 60;
  return d > 0 ? Math.round(d * 100) / 100 : 0;
}

/** Regroupe les créneaux enregistrés par classe : une classe, plusieurs jours de cours. */
function toCourses(slots: SlotInput[], seed: { current: number }): Course[] {
  const byClass = new Map<string, Course>();
  for (const s of slots) {
    const key = `${s.classe.trim().toLowerCase()}|${s.rate}`;
    let c = byClass.get(key);
    if (!c) {
      c = { id: seed.current++, classe: s.classe, rate: s.rate, sessions: [] };
      byClass.set(key, c);
    }
    c.sessions.push({ id: seed.current++, day: s.day, start: s.start, end: s.end });
  }
  return [...byClass.values()];
}

/** Formulaire enseignant : identité, photo d'inscription (vérifiée), emploi du temps par classe. */
export function TeacherForm({
  mode,
  action,
  teacherId,
  initial,
  classSuggestions = [],
  vocab = DEFAULT_VOCAB,
}: {
  mode: "create" | "edit";
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  teacherId?: string;
  initial?: TeacherFormInitial;
  classSuggestions?: string[];
  vocab?: FormVocab;
}) {
  const { state, pending, submit } = useActionForm(action);
  const [fields, setFields] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    subject: initial?.subject ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
  });
  const nextId = useRef(1);
  const [courses, setCourses] = useState<Course[]>(() =>
    initial?.slots.length
      ? toCourses(initial.slots, nextId)
      : [{ id: nextId.current++, classe: "", rate: 3000, sessions: [{ id: nextId.current++, day: "Lundi", start: "08:00", end: "10:00" }] }],
  );

  // Les fichiers vivent dans l'état React (jamais dans un <input type=file>) : ils survivent
  // à une erreur de validation renvoyée par le serveur.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [photoTouched, setPhotoTouched] = useState(false);
  const [busy, setBusy] = useState<"photo" | "doc" | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [face, setFace] = useState<{ status: "idle" | "checking" | "ok" | "ko"; message?: string; descriptor?: number[] }>({
    status: initial?.hasFace ? "ok" : "idle",
  });

  // Les modèles de reconnaissance (~7 Mo) se chargent pendant que la direction saisit la fiche.
  useEffect(() => preloadModels(), []);

  const flat = useMemo(
    () =>
      courses.flatMap((c) =>
        c.sessions.map((s) => ({ classe: c.classe.trim(), day: s.day, startTime: s.start, endTime: s.end, hoursPerWeek: durationH(s.start, s.end), hourlyRate: c.rate })),
      ),
    [courses],
  );

  const totals = useMemo(() => {
    const hours = flat.reduce((s, r) => s + r.hoursPerWeek, 0);
    const monthly = flat.reduce((s, r) => s + r.hoursPerWeek * WEEKS_PER_MONTH * (r.hourlyRate || 0), 0);
    return { hours: Math.round(hours * 100) / 100, monthly, count: flat.length };
  }, [flat]);

  /** Chevauchements dans la semaine de cet enseignant (il ne peut pas être à deux endroits). */
  const clashes = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        const a = flat[i];
        const b = flat[j];
        if (a.day !== b.day) continue;
        if (toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime)) {
          out.add(`${a.day}|${a.startTime}|${a.classe}`);
          out.add(`${b.day}|${b.startTime}|${b.classe}`);
        }
      }
    }
    return out;
  }, [flat]);

  const classes = [...new Set(classSuggestions)];
  const conflictRefused = !!state.error && /a déjà cours avec/.test(state.error);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const patchCourse = (id: number, p: Partial<Course>) => setCourses((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const patchSession = (cid: number, sid: number, p: Partial<Session>) =>
    setCourses((cs) => cs.map((c) => (c.id === cid ? { ...c, sessions: c.sessions.map((s) => (s.id === sid ? { ...s, ...p } : s)) } : c)));

  const addCourse = () =>
    setCourses((cs) => [
      ...cs,
      { id: nextId.current++, classe: "", rate: cs[cs.length - 1]?.rate ?? 3000, sessions: [{ id: nextId.current++, day: "Lundi", start: "08:00", end: "10:00" }] },
    ]);
  const addSession = (cid: number) =>
    setCourses((cs) =>
      cs.map((c) => {
        if (c.id !== cid) return c;
        const last = c.sessions[c.sessions.length - 1];
        const day = last ? DAYS[(DAYS.indexOf(last.day) + 1) % DAYS.length] : "Lundi";
        return { ...c, sessions: [...c.sessions, { id: nextId.current++, day, start: last?.start ?? "08:00", end: last?.end ?? "10:00" }] };
      }),
    );
  const removeSession = (cid: number, sid: number) =>
    setCourses((cs) => cs.map((c) => (c.id === cid ? { ...c, sessions: c.sessions.filter((s) => s.id !== sid) } : c)).filter((c) => c.sessions.length > 0));
  const removeCourse = (cid: number) => setCourses((cs) => cs.filter((c) => c.id !== cid));

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    setBusy("photo");
    const small = await compressImage(file, 800, 0.82, "photo.jpg");
    setPhotoFile(small);
    setPhotoPreview(URL.createObjectURL(small));
    setPhotoTouched(true);
    setBusy(null);

    setFace({ status: "checking" });
    const res = await describeFile(small);
    if ("descriptor" in res) {
      setFace({ status: "ok", descriptor: res.descriptor });
    } else {
      setFace({ status: "ko", message: FACE_FAILURE_MESSAGE[res.error] });
    }
  }

  async function onDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    if (file.type === "application/pdf") {
      if (file.size > 3.5 * 1024 * 1024) {
        setFileError("PDF trop lourd (3,5 Mo maximum). Prenez plutôt une photo de l'emploi du temps.");
        return;
      }
      setDocFile(file);
    } else {
      setBusy("doc");
      setDocFile(await compressImage(file, 1800, 0.8, "emploi-du-temps.jpg"));
      setBusy(null);
    }
    setDocName(file.name);
  }

  const fieldCls = "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
  const slotCls = "h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:border-brand-400";
  const photoMissing = mode === "create" && !photoPreview;

  return (
    <form
      onSubmit={submit((fd) => {
        if (photoFile) fd.set("photo", photoFile);
        if (docFile) fd.set("timetable", docFile);
      })}
      className="space-y-6"
    >
      {teacherId && <input type="hidden" name="teacherId" value={teacherId} />}
      <input type="hidden" name="assignments" value={JSON.stringify(flat)} />
      <input type="hidden" name="faceDescriptor" value={face.descriptor ? JSON.stringify(face.descriptor) : ""} />
      <datalist id="pointa-classes">{classes.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="pointa-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-foreground">
              Photo d&apos;inscription <span className="text-absent">*</span>
            </h3>
            <p className="mt-1 text-xs text-muted">
              C&apos;est la photo de référence : à chaque pointage, le visage filmé est comparé à celle-ci. Visage de face, bien éclairé, une seule personne.
            </p>
            <div className="mt-4 flex flex-col items-center">
              <div className={`flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-surface-2 ${photoMissing ? "border-absent/60" : "border-border"}`}>
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Photo de l'enseignant" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="camera" size={36} className="text-muted" />
                )}
              </div>
              <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-sm font-semibold text-brand-700 hover:bg-surface-2">
                <Icon name="camera" size={16} /> {busy === "photo" ? "Traitement…" : photoPreview ? "Changer la photo" : "Prendre / choisir"}
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
              <FaceState state={face} photoTouched={photoTouched} hadFace={!!initial?.hasFace} />
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-foreground">Emploi du temps (document)</h3>
            <p className="mt-1 text-xs text-muted">Facultatif : gardez une photo ou le PDF de l&apos;emploi du temps sur la fiche.</p>
            <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2 px-4 py-5 text-center hover:border-brand-400">
              <Icon name="upload" size={22} className="text-brand-600" />
              <span className="text-sm font-medium text-foreground">{busy === "doc" ? "Traitement…" : docName ?? "Importer une photo ou un PDF"}</span>
              <span className="text-xs text-muted">JPG, PNG ou PDF</span>
              <input type="file" accept="image/*,application/pdf" onChange={onDoc} className="hidden" />
            </label>
          </Card>
          {fileError && <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent">{fileError}</p>}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Prénom" name="firstName" value={fields.firstName} onChange={set("firstName")} placeholder="Armand" autoComplete="given-name" required cls={fieldCls} />
              <Text label="Nom" name="lastName" value={fields.lastName} onChange={set("lastName")} placeholder="Nkodia" autoComplete="family-name" required cls={fieldCls} />
              <Text label="Matière principale" name="subject" value={fields.subject} onChange={set("subject")} placeholder="Mathématiques" list="pointa-subjects" cls={fieldCls} />
              <Text
                label="Numéro de téléphone"
                name="phone"
                value={fields.phone}
                onChange={set("phone")}
                placeholder="06 100 20 30"
                type="tel"
                inputMode="tel"
                required
                hint={`Identifiant du ${vocab.staffOne}. À la 1re connexion, il sert aussi de mot de passe, puis il choisit son code personnel.`}
                cls={fieldCls}
              />
              <Text label="Email (facultatif)" name="email" value={fields.email} onChange={set("email")} placeholder="prenom.nom@ecole.cg" type="email" cls={fieldCls} />
            </div>
          </Card>

          <Card padded={false}>
            <CardHeader
              title="Emploi du temps"
              subtitle={`Une ${vocab.groupOne} par bloc, autant de jours de cours que nécessaire.`}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={addCourse}>
                  <Icon name="plus" size={16} /> Ajouter une {vocab.groupOne}
                </Button>
              }
            />
            <div className="space-y-4 p-4 sm:p-5">
              {courses.length === 0 && (
                <p className="rounded-xl bg-surface-2 px-4 py-4 text-sm text-muted">
                  Aucun cours. Vous pourrez compléter l&apos;emploi du temps plus tard — sans créneau, les heures ne sont ni attendues ni payées.
                </p>
              )}

              {courses.map((c, ci) => {
                const hours = c.sessions.reduce((s, x) => s + durationH(x.start, x.end), 0);
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-surface-2/40">
                    <div className="flex flex-wrap items-end gap-3 border-b border-border px-3 py-3 sm:px-4">
                      <div className="min-w-[10rem] flex-1">
                        <Labeled label={cap(vocab.groupOne)}>
                          <input
                            value={c.classe}
                            onChange={(e) => patchCourse(c.id, { classe: e.target.value })}
                            list="pointa-classes"
                            placeholder={vocab.example}
                            className={`${slotCls} font-semibold`}
                            required
                          />
                        </Labeled>
                      </div>
                      <Labeled label="Taux / heure">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={250}
                          value={c.rate}
                          onChange={(e) => patchCourse(c.id, { rate: Number(e.target.value) })}
                          className="h-10 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm outline-none focus:border-brand-400"
                        />
                      </Labeled>
                      {courses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCourse(c.id)}
                          className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-absent-bg hover:text-absent"
                          title={`Retirer cette ${vocab.groupOne}`}
                        >
                          <Icon name="x" size={15} /> Retirer
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 px-3 py-3 sm:px-4">
                      {c.sessions.map((s) => {
                        const d = durationH(s.start, s.end);
                        const clash = clashes.has(`${s.day}|${s.start}|${c.classe.trim()}`);
                        return (
                          <div key={s.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2 ${d === 0 || clash ? "border-absent/50 bg-absent-bg/40" : "border-border bg-surface"}`}>
                            <select value={s.day} onChange={(e) => patchSession(c.id, s.id, { day: e.target.value })} className={`${slotCls} w-32`} aria-label="Jour">
                              {DAYS.map((day) => <option key={day}>{day}</option>)}
                            </select>
                            <input type="time" value={s.start} onChange={(e) => patchSession(c.id, s.id, { start: e.target.value })} className={`${slotCls} w-28`} aria-label="Début" required />
                            <span className="text-muted">→</span>
                            <input type="time" value={s.end} onChange={(e) => patchSession(c.id, s.id, { end: e.target.value })} className={`${slotCls} w-28`} aria-label="Fin" required />
                            <span className={`ml-auto text-xs ${d === 0 ? "font-semibold text-absent" : "text-muted"}`}>
                              {d === 0 ? "Fin avant le début" : `${d} h`}
                            </span>
                            {clash && d > 0 && <span className="text-xs font-semibold text-absent">Chevauchement</span>}
                            <button
                              type="button"
                              onClick={() => removeSession(c.id, s.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-absent-bg hover:text-absent"
                              aria-label="Retirer cette séance"
                            >
                              <Icon name="x" size={15} />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button type="button" onClick={() => addSession(c.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                          <Icon name="plus" size={15} /> Ajouter un jour de cours
                        </button>
                        <p className="text-xs text-muted">
                          {c.sessions.length} séance{c.sessions.length > 1 ? "s" : ""} · <strong className="text-foreground">{Math.round(hours * 100) / 100} h/semaine</strong> ·{" "}
                          {formatMoney(hours * WEEKS_PER_MONTH * (c.rate || 0))} / mois
                        </p>
                      </div>
                    </div>
                    {ci === courses.length - 1 && <span className="sr-only">Fin de la liste des cours</span>}
                  </div>
                );
              })}

              {totals.count > 0 && (
                <>
                  <WeekPreview slots={flat} clashes={clashes} />
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
                    <p className="text-sm text-brand-700">
                      <strong>{totals.hours} h/semaine</strong> · {courses.length} {courses.length > 1 ? vocab.groupMany.toLowerCase() : vocab.groupOne} · {totals.count} séance
                      {totals.count > 1 ? "s" : ""} · quota mensuel {Math.round(totals.hours * WEEKS_PER_MONTH)} h
                    </p>
                    <p className="text-sm font-bold text-brand-700">Potentiel : {formatMoney(totals.monthly)} / mois</p>
                  </div>
                </>
              )}
              {clashes.size > 0 && (
                <p className="rounded-xl bg-absent-bg px-4 py-3 text-sm font-medium text-absent">
                  Deux cours se chevauchent : un {vocab.staffOne} ne peut pas être à deux endroits en même temps. Corrigez les créneaux en rouge.
                </p>
              )}
            </div>
          </Card>

          {state.error && (
            <div className="rounded-xl bg-absent-bg px-4 py-3 text-sm text-absent" role="alert">
              <p className="font-medium">{state.error}</p>
              {conflictRefused && (
                <label className="mt-2 flex items-start gap-2 text-foreground">
                  <input type="checkbox" name="allowConflict" value="1" className="mt-0.5 h-4 w-4 rounded border-border" />
                  <span className="text-xs">
                    C&apos;est normal : deux {vocab.staffOne}s interviennent ensemble sur ce créneau. Enregistrer quand même.
                  </span>
                </label>
              )}
            </div>
          )}
          {photoMissing && !state.error && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
              La photo d&apos;inscription est obligatoire : sans elle, aucun pointage ne peut être vérifié.
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Link href={teacherId ? `/app/employees/${teacherId}` : "/app/employees"} className="inline-flex h-11 items-center rounded-xl border border-border px-5 font-semibold text-foreground hover:bg-surface-2">
              Annuler
            </Link>
            <Button type="submit" disabled={pending || busy !== null || face.status === "checking" || clashes.size > 0 || photoMissing}>
              <Icon name="check" size={18} />{" "}
              {pending ? "Enregistrement…" : mode === "create" ? `Enregistrer ${/^[aeiouyéèê]/i.test(vocab.staffOne) ? "l'" : "le "}${vocab.staffOne}` : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Retour visuel sur l'empreinte du visage calculée depuis la photo d'inscription. */
function FaceState({ state, photoTouched, hadFace }: { state: { status: string; message?: string }; photoTouched: boolean; hadFace: boolean }) {
  if (state.status === "checking") return <p className="mt-3 text-center text-xs text-muted">Analyse du visage…</p>;
  if (state.status === "ok")
    return (
      <p className="mt-3 flex items-start gap-1.5 text-center text-xs font-medium text-present">
        <Icon name="check" size={14} className="mt-0.5 shrink-0" />
        {photoTouched ? "Visage enregistré : les pointages seront vérifiés." : hadFace ? "Visage déjà enregistré." : ""}
      </p>
    );
  if (state.status === "ko")
    return (
      <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-late">
        <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
        <span>
          {state.message} La fiche sera enregistrée, mais les pointages ne pourront pas être vérifiés tant qu&apos;une photo exploitable n&apos;est pas ajoutée.
        </span>
      </p>
    );
  return null;
}

/** Aperçu de la semaine : ce que l'enseignant verra sur son téléphone. */
function WeekPreview({ slots, clashes }: { slots: { classe: string; day: string; startTime: string; endTime: string }[]; clashes: Set<string> }) {
  const byDay = DAYS.map((day) => ({
    day,
    items: slots.filter((s) => s.day === day).sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
  }));
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="grid min-w-[36rem] grid-cols-6 divide-x divide-border">
        {byDay.map(({ day, items }) => (
          <div key={day} className="min-w-0">
            <p className="border-b border-border bg-surface-2 px-2 py-1.5 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{SHORT[day]}</p>
            <div className="space-y-1 p-1.5">
              {items.length === 0 && <p className="py-2 text-center text-[0.7rem] text-muted/60">—</p>}
              {items.map((s, i) => {
                const bad = clashes.has(`${s.day}|${s.startTime}|${s.classe.trim()}`);
                return (
                  <div key={i} className={`rounded-lg px-1.5 py-1 text-[0.7rem] leading-tight ${bad ? "bg-absent-bg text-absent" : "bg-brand-50 text-brand-700"}`}>
                    <p className="font-semibold tabular-nums">{s.startTime}–{s.endTime}</p>
                    <p className="truncate">{s.classe || "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Labeled({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={inline ? "flex items-center gap-2" : "block"}>
      <span className={`${inline ? "" : "mb-1 "}block text-[0.7rem] font-medium uppercase tracking-wide text-muted`}>{label}</span>
      {children}
    </label>
  );
}

function Text({
  label,
  hint,
  cls,
  ...props
}: { label: string; hint?: string; cls: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={props.name}>{label}</label>
      <input id={props.name} {...props} className={cls} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
