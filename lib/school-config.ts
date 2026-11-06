import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { structureOf, type Structure, type StructureKind } from "@/config/structures";

/**
 * Configuration d'un établissement (type de structure, niveaux/classes, taille).
 * Enregistrée comme un événement du journal (activity_log, resource « config:{…} ») :
 * le dernier événement fait foi et l'historique reste visible par l'établissement.
 */
export interface SchoolConfig {
  kind: StructureKind;
  levels: string[];
  staffSize: string | null;
  /** Refuser le pointage quand le visage ne correspond pas à la photo d'inscription. */
  faceStrict: boolean;
  /** Faux tant que les questions de mise en route n'ont pas été répondues. */
  configured: boolean;
  structure: Structure;
}

interface ConfigEvent {
  kind: StructureKind;
  levels?: string[];
  staffSize?: string | null;
  faceStrict?: boolean;
}

function build(ev: ConfigEvent | null): SchoolConfig {
  const structure = structureOf(ev?.kind);
  return {
    kind: structure.kind,
    levels: ev?.levels?.length ? ev.levels : structure.levels,
    staffSize: ev?.staffSize ?? null,
    faceStrict: ev?.faceStrict ?? true,
    configured: !!ev,
    structure,
  };
}

export async function getSchoolConfig(schoolId: string): Promise<SchoolConfig> {
  const { data } = await supabaseAdmin()
    .from("activity_log")
    .select("resource")
    .eq("school_id", schoolId)
    .like("resource", "config:%")
    .order("created_at", { ascending: false })
    .limit(1);
  const raw = (data as { resource: string | null }[] | null)?.[0]?.resource;
  if (!raw) return build(null);
  try {
    return build(JSON.parse(raw.slice(7)) as ConfigEvent);
  } catch {
    return build(null);
  }
}

/** Écrit une nouvelle configuration. Les champs non fournis gardent leur valeur actuelle. */
export async function setSchoolConfig(
  schoolId: string,
  input: { kind?: StructureKind; levels?: string[]; staffSize?: string | null; faceStrict?: boolean; actor: string; action?: string },
) {
  const current = await getSchoolConfig(schoolId);
  const structure = structureOf(input.kind ?? current.kind);
  const ev: ConfigEvent = {
    kind: structure.kind,
    levels: input.levels ?? current.levels,
    staffSize: input.staffSize === undefined ? current.staffSize : input.staffSize,
    faceStrict: input.faceStrict === undefined ? current.faceStrict : input.faceStrict,
  };
  const levels = ev.levels ?? [];
  const { error } = await supabaseAdmin().from("activity_log").insert({
    school_id: schoolId,
    actor: input.actor,
    action:
      input.action ??
      `a configuré l'établissement : ${structure.label}${levels.length ? ` (${levels.length} ${levels.length > 1 ? structure.groupMany.toLowerCase() : structure.groupOne})` : ""}`,
    resource: `config:${JSON.stringify(ev)}`,
  });
  return !error;
}
