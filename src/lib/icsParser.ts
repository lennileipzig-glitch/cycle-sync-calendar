// Minimal iCalendar (.ics) parser - VEVENT only
export interface ParsedEvent {
  title: string;
  starts_at: string; // ISO
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  external_uid: string | null;
}

const unfold = (txt: string) => txt.replace(/\r?\n[ \t]/g, "");

const parseDate = (val: string, isDate: boolean): string => {
  // Format: 20250115T103000Z or 20250115T103000 or 20250115
  if (isDate || val.length === 8) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
  }
  const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
  const hh = val.slice(9, 11), mm = val.slice(11, 13), ss = val.slice(13, 15) || "00";
  const z = val.endsWith("Z") ? "Z" : "";
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${z}`).toISOString();
};

const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

export function parseICS(text: string): ParsedEvent[] {
  const lines = unfold(text).split(/\r?\n/);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> & { _allDay?: boolean } | null = null;

  for (const raw of lines) {
    if (raw === "BEGIN:VEVENT") cur = {};
    else if (raw === "END:VEVENT") {
      if (cur && cur.title && cur.starts_at) {
        events.push({
          title: cur.title,
          starts_at: cur.starts_at,
          ends_at: cur.ends_at ?? null,
          all_day: !!cur._allDay,
          location: cur.location ?? null,
          external_uid: cur.external_uid ?? null,
        });
      }
      cur = null;
    } else if (cur) {
      const colonIdx = raw.indexOf(":");
      if (colonIdx < 0) continue;
      const head = raw.slice(0, colonIdx);
      const value = raw.slice(colonIdx + 1);
      const [key, ...params] = head.split(";");
      const isDate = params.some(p => p.toUpperCase() === "VALUE=DATE");
      switch (key.toUpperCase()) {
        case "SUMMARY": cur.title = unescape(value); break;
        case "DTSTART":
          cur.starts_at = parseDate(value, isDate);
          if (isDate) cur._allDay = true;
          break;
        case "DTEND": cur.ends_at = parseDate(value, isDate); break;
        case "LOCATION": cur.location = unescape(value); break;
        case "UID": cur.external_uid = value; break;
      }
    }
  }
  return events;
}
