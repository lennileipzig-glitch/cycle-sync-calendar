// Verpackt strukturierte Meta-Daten (Rezept-/Workout-Details) im `details`-Textfeld
// von calendar_events. So können wir später beim Bearbeiten Schritte/Zutaten/Übungen
// und Portionszahl wieder anzeigen, ohne neue Datenbank-Spalten anzulegen.

const META_MARK = "\n\n[[FRAVIA_META]]\n";

export interface RecipeMeta {
  kind: "recipe";
  servings?: number;
  ingredients?: { name: string; amount?: number; unit?: string }[];
  steps?: string[];
  nutrients?: string[];
  uses_from_fridge?: string[];
  why?: string;
}

export interface WorkoutMeta {
  kind: "workout";
  duration?: string;
  intensity?: string;
  why?: string;
  exercises?: { name: string; details?: string; sets?: string }[];
}

export type EventMeta = RecipeMeta | WorkoutMeta;

export function packMeta(text: string, meta: EventMeta | null | undefined): string {
  const t = (text ?? "").trim();
  if (!meta) return t;
  return `${t}${META_MARK}${JSON.stringify(meta)}`;
}

export function unpackMeta(details?: string | null): { text: string; meta: EventMeta | null } {
  if (!details) return { text: "", meta: null };
  const i = details.indexOf(META_MARK);
  if (i < 0) return { text: details, meta: null };
  try {
    const meta = JSON.parse(details.slice(i + META_MARK.length)) as EventMeta;
    return { text: details.slice(0, i), meta };
  } catch {
    return { text: details, meta: null };
  }
}
