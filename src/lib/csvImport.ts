// CSV-Import von Zyklus-Apps (Clue, Flo, etc.)
// Erwartet Header mit mindestens "date" + optional "period", "mood", "energy", "symptoms", "notes"
export interface ImportedLog {
  log_date: string; // YYYY-MM-DD
  mood: string | null;
  energy_level: string | null;
  symptoms: string[];
  notes: string | null;
  is_period_start: boolean;
}

const parseLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]/g, "");

const findCol = (headers: string[], names: string[]) =>
  headers.findIndex(h => names.includes(norm(h)));

const toISODate = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // DD.MM.YYYY or DD/MM/YYYY
  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // MM/DD/YYYY fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

export interface ImportResult {
  logs: ImportedLog[];
  earliestPeriodStart: string | null;
  totalRows: number;
}

export function parseCycleCSV(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { logs: [], earliestPeriodStart: null, totalRows: 0 };

  const headers = parseLine(lines[0]);
  const dateCol = findCol(headers, ["date", "datum", "tag", "day"]);
  const periodCol = findCol(headers, ["period", "periode", "menstruation", "bleeding", "blutung"]);
  const moodCol = findCol(headers, ["mood", "stimmung"]);
  const energyCol = findCol(headers, ["energy", "energielevel", "energie"]);
  const symptomsCol = findCol(headers, ["symptoms", "symptome", "beschwerden"]);
  const notesCol = findCol(headers, ["notes", "note", "notiz", "notizen"]);

  if (dateCol < 0) throw new Error("Keine Datums-Spalte gefunden (erwartet: 'date' oder 'datum')");

  const logs: ImportedLog[] = [];
  let earliestPeriodStart: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const iso = toISODate(cells[dateCol] ?? "");
    if (!iso) continue;

    const periodVal = periodCol >= 0 ? norm(cells[periodCol] ?? "") : "";
    const isPeriod = ["1", "true", "yes", "ja", "heavy", "medium", "light", "spotting", "stark", "mittel", "leicht"].includes(periodVal);

    if (isPeriod && (!earliestPeriodStart || iso > earliestPeriodStart)) {
      // We track the most recent period start (consecutive days = same period)
      const prev = logs[logs.length - 1];
      if (!prev || prev.log_date !== isoMinusDay(iso) || !prev.is_period_start) {
        earliestPeriodStart = iso;
      } else if (!earliestPeriodStart || iso > earliestPeriodStart) {
        // continuing period — don't update start
      }
    }

    const symptomsRaw = symptomsCol >= 0 ? (cells[symptomsCol] ?? "") : "";
    const symptoms = symptomsRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean);

    logs.push({
      log_date: iso,
      mood: moodCol >= 0 ? (cells[moodCol] || null) : null,
      energy_level: energyCol >= 0 ? (cells[energyCol] || null) : null,
      symptoms,
      notes: notesCol >= 0 ? (cells[notesCol] || null) : null,
      is_period_start: isPeriod,
    });
  }

  // recompute earliest = most recent period day where the day before was NOT a period
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  let mostRecentStart: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].is_period_start) {
      const prev = sorted[i - 1];
      if (!prev || !prev.is_period_start) mostRecentStart = sorted[i].log_date;
    }
  }

  return { logs, earliestPeriodStart: mostRecentStart, totalRows: logs.length };
}

const isoMinusDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
