import { differenceInDays, addDays, format, startOfDay } from "date-fns";

export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal" | "unknown";

export interface PhaseInfo {
  phase: Phase;
  label: string;
  dayInCycle: number;
  cycleLength: number;
  description: string;
  color: string;
  nutrition: string[];
  exercise: string[];
}

const PHASE_DATA: Record<Exclude<Phase, "unknown">, Omit<PhaseInfo, "phase" | "dayInCycle" | "cycleLength">> = {
  menstrual: {
    label: "Menstruation",
    description: "Ruhe & Regeneration. Dein Körper braucht jetzt Wärme, Eisen und Mitgefühl.",
    color: "hsl(var(--phase-menstrual))",
    nutrition: ["Eisenreiches Gemüse", "Linsen & Hülsenfrüchte", "Dunkle Schokolade", "Ingwer- & Kamillentee"],
    exercise: ["Sanftes Yin-Yoga", "Spaziergänge", "Stretching", "Ruhe-Tage erlaubt"],
  },
  follicular: {
    label: "Follikelphase",
    description: "Energie steigt. Zeit für Neues, Kreatives und Bewegung.",
    color: "hsl(var(--phase-follicular))",
    nutrition: ["Frische Sprossen & Salate", "Fermentiertes (Kimchi)", "Avocado & Nüsse", "Beeren"],
    exercise: ["Cardio & Laufen", "Tanzen", "HIIT-Einheiten", "Neue Sportarten ausprobieren"],
  },
  ovulation: {
    label: "Ovulation",
    description: "Höchste Energie & Strahlkraft. Großes wagen, sichtbar sein.",
    color: "hsl(var(--phase-ovulation))",
    nutrition: ["Antioxidantienreiches Gemüse", "Kreuzblütler (Brokkoli)", "Quinoa & Samen", "Viel Wasser"],
    exercise: ["Krafttraining (schwere Gewichte)", "Gruppenkurse", "Klettern", "Intensives HIIT"],
  },
  luteal: {
    label: "Lutealphase",
    description: "Fokus & Aufräumen. Dein Körper braucht Magnesium und Mitgefühl mit sich.",
    color: "hsl(var(--phase-luteal))",
    nutrition: ["Süßkartoffel & Kürbis", "Magnesiumreiches (Mandeln, Spinat)", "Lachs & Omega-3", "B-Vitamine"],
    exercise: ["Pilates", "Lange Spaziergänge", "Yoga", "Moderates Krafttraining"],
  },
};

export function getPhase(today: Date, lastPeriodStart: Date | null, cycleLength = 28, periodLength = 5, irregular = false): PhaseInfo {
  if (!lastPeriodStart) {
    return {
      phase: "unknown",
      label: "Phase unbekannt",
      dayInCycle: 0,
      cycleLength,
      description: "Trage deinen letzten Periodenstart ein, um deine Phase zu sehen.",
      color: "hsl(var(--muted-foreground))",
      nutrition: [],
      exercise: [],
    };
  }
  const days = differenceInDays(startOfDay(today), startOfDay(lastPeriodStart));
  const dayInCycle = ((days % cycleLength) + cycleLength) % cycleLength + 1;
  const ovulationDay = cycleLength - 14;
  let phase: Exclude<Phase, "unknown">;
  if (dayInCycle <= periodLength) phase = "menstrual";
  else if (dayInCycle < ovulationDay - 1) phase = "follicular";
  else if (dayInCycle <= ovulationDay + 1) phase = "ovulation";
  else phase = "luteal";

  // Bei unregelmäßigem Zyklus nur Menstruation anzeigen, wenn die Blutung
  // explizit kürzlich (innerhalb periodLength Tagen) markiert wurde.
  // Andere Phasen sind nicht zuverlässig vorhersagbar → "unbekannt".
  if (irregular) {
    const sinceStart = days; // Tage seit Markierung
    if (sinceStart >= 0 && sinceStart < periodLength) {
      return { phase: "menstrual", dayInCycle: sinceStart + 1, cycleLength, ...PHASE_DATA.menstrual };
    }
    return {
      phase: "unknown",
      label: "Phase unbekannt",
      dayInCycle: 0,
      cycleLength,
      description: "Bei unregelmäßigem Zyklus markiere bitte den Beginn deiner Blutung im Tages-Tracker.",
      color: "hsl(var(--muted-foreground))",
      nutrition: [],
      exercise: [],
    };
  }

  return { phase, dayInCycle, cycleLength, ...PHASE_DATA[phase] };
}

export function phaseForDate(date: Date, lastPeriodStart: Date | null, cycleLength = 28, periodLength = 5, irregular = false): Phase {
  return getPhase(date, lastPeriodStart, cycleLength, periodLength, irregular).phase;
}

export const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
export const addDaysFn = addDays;

/**
 * Mapping Energieaufwand (1–5) → bevorzugte Zyklusphasen.
 * Hoch (≥3.5) → Ovulation + Follikel
 * Niedrig (≤2.5) → Menstruation + Luteal
 * Mittel → alle (kein Filter)
 */
export function preferredPhasesForEnergyCost(cost: number): Phase[] {
  if (cost >= 3.5) return ["ovulation", "follicular"];
  if (cost <= 2.5) return ["menstrual", "luteal"];
  return ["menstrual", "follicular", "ovulation", "luteal"];
}

/**
 * Findet den nächstbesten Tag im laufenden Zyklus, dessen Phase zum Aufwand passt.
 * Sucht ab `from` bis zu `lookaheadDays` voraus. Fällt auf `from` zurück, wenn nichts passt.
 */
export function findNextDateForEnergyCost(
  from: Date,
  cost: number,
  lastPeriodStart: Date | null,
  cycleLength = 28,
  periodLength = 5,
  lookaheadDays = 35,
  irregular = false,
): Date {
  if (!lastPeriodStart || irregular) return from;
  const preferred = new Set(preferredPhasesForEnergyCost(cost));
  for (let i = 0; i <= lookaheadDays; i++) {
    const d = addDays(from, i);
    const ph = phaseForDate(d, lastPeriodStart, cycleLength, periodLength);
    if (preferred.has(ph)) return d;
  }
  return from;
}
