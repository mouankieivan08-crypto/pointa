import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "./supabase/server";
import { localToday, localNowMinutes, weekdayOf, hhmmToMin } from "./time";

/**
 * Moteur de rappels par créneau + envoi Web Push.
 * Appelé par /api/cron/notify (cron externe toutes les 5–10 min).
 * Créneaux du jour = emploi du temps hebdomadaire + séances ponctuelles datées
 * (remplacements, heures sup.). Pas de rappel pour un enseignant archivé ou en congé.
 */

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@pointa.app", pub, priv);
  vapidReady = true;
  return true;
}

interface AssignRow {
  id: string;
  start_time: string | null;
  end_time: string | null;
  classe: string;
  teacher_id: string;
  teachers: { id: string; school_id: string; first_name: string; status: string } | null;
}

export async function createNotification(schoolId: string, teacherId: string | null, type: string, title: string, body: string) {
  await supabaseAdmin().from("notifications").insert({ school_id: schoolId, teacher_id: teacherId, type, title, body });
}

/** Enregistre un envoi ; renvoie false si déjà envoyé (anti-doublon). */
async function claim(assignmentId: string, teacherId: string, kind: string, date: string): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("notification_log")
    .insert({ assignment_id: assignmentId, teacher_id: teacherId, kind, the_date: date });
  return !error; // conflit d'unicité = déjà envoyé
}

async function pushToTeacher(teacherId: string, title: string, body: string) {
  if (!ensureVapid()) return;
  const { data } = await supabaseAdmin().from("push_subscriptions").select("*").eq("teacher_id", teacherId);
  for (const s of (data as { id: string; endpoint: string; p256dh: string; auth: string }[]) ?? []) {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url: "/espace" }));
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await supabaseAdmin().from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
}

export async function runReminders(): Promise<{ checked: number; sent: number }> {
  const date = localToday();
  const nowMin = localNowMinutes();
  const sb = supabaseAdmin();

  const { data } = await sb
    .from("class_assignments")
    .select("id,start_time,end_time,classe,teacher_id,teachers(id,school_id,first_name,status)")
    .in("day", [weekdayOf(date), date]);
  const rows = ((data as unknown as AssignRow[]) ?? []).filter((r) => r.teachers?.status === "active");
  if (!rows.length) return { checked: 0, sent: 0 };

  const teacherIds = [...new Set(rows.map((r) => r.teacher_id))];
  const [{ data: att }, { data: leaves }] = await Promise.all([
    sb.from("attendance").select("teacher_id,check_in,check_out").eq("date", date).in("teacher_id", teacherIds),
    sb.from("leaves").select("teacher_id").eq("status", "accepted").lte("start_date", date).gte("end_date", date).in("teacher_id", teacherIds),
  ]);
  const onLeave = new Set(((leaves as { teacher_id: string }[] | null) ?? []).map((l) => l.teacher_id));
  // Enseignants pointés (arrivée) mais pas encore partis aujourd'hui
  const checkedInNotOut = new Set<string>();
  for (const a of (att as { teacher_id: string; check_in: string | null; check_out: string | null }[]) ?? []) {
    if (a.check_in && !a.check_out) checkedInNotOut.add(a.teacher_id);
  }

  let sent = 0;
  for (const r of rows) {
    const t = r.teachers!;
    if (onLeave.has(r.teacher_id)) continue;
    const start = hhmmToMin(r.start_time);
    const end = hhmmToMin(r.end_time);

    // Cours dans ~30 min
    if (start != null) {
      const diff = start - nowMin;
      if (diff >= 25 && diff <= 35 && (await claim(r.id, r.teacher_id, "cours_bientot", date))) {
        const title = "Vous avez cours bientôt";
        const body = `${r.classe} à ${r.start_time} — dans ${diff} min. Pensez à pointer votre arrivée.`;
        await createNotification(t.school_id, r.teacher_id, "cours_bientot", title, body);
        await pushToTeacher(r.teacher_id, title, body);
        sent++;
      }
    }

    // Fin de cours dans ~5 min et pas encore de départ pointé
    if (end != null) {
      const diff = end - nowMin;
      if (diff >= 0 && diff <= 8 && checkedInNotOut.has(r.teacher_id) && (await claim(r.id, r.teacher_id, "pointer_depart", date))) {
        const title = "Pensez à pointer votre départ";
        const body = `Votre cours de ${r.classe} se termine à ${r.end_time}. N'oubliez pas de pointer la sortie.`;
        await createNotification(t.school_id, r.teacher_id, "pointer_depart", title, body);
        await pushToTeacher(r.teacher_id, title, body);
        sent++;
      }
    }
  }

  return { checked: rows.length, sent };
}
