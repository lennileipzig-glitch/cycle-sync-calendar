import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  startOfDay, startOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear, endOfWeek,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";
import { dataApi, type DailyLog } from "@/lib/dataApi";
import { fmtDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";

type Range = "day" | "week" | "month" | "year";
const RANGES: Range[] = ["day", "week", "month", "year"];
const RANGE_LABELS: Record<Range, string> = { day: "Tag", week: "Woche", month: "Monat", year: "Jahr" };
const ENERGY_LABELS = ["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"];

const energyToNum = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  if (raw === "niedrig") return 2;
  if (raw === "hoch") return 4;
  if (raw === "mittel") return 3;
  return null;
};

interface Point { date: string; label: string; energy: number | null; raw?: DailyLog }

export function EnergyChart({ userId }: { userId: string | null }) {
  const [range, setRange] = useState<Range>("month");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [selected, setSelected] = useState<Date | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [selectedTodos, setSelectedTodos] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<{ id: string; title: string; starts_at: string; all_day: boolean }[]>([]);

  // Lade ALLE Logs einmalig (clientseitig gefiltert; bei Bedarf später paginieren)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Nutze einen breiten Bereich: letzte 2 Jahre
      const end = new Date();
      const start = subYears(end, 2);
      const days = eachDayOfInterval({ start, end });
      const out: DailyLog[] = [];
      // Wir holen pro Tag (langsam für Supabase) – effizienter wäre ein Range-Query.
      // Für jetzt: ein Bulk-Query.
      const all = await fetchLogsBulk(userId, fmtDate(start), fmtDate(end));
      if (cancelled) return;
      setLogs(all);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const { data, domain, viewLabel } = useMemo(() => buildSeries(range, anchor, logs), [range, anchor, logs]);

  const handlePrev = () => {
    if (range === "day") setAnchor(d => subDays(d, 1));
    else if (range === "week") setAnchor(d => subWeeks(d, 1));
    else if (range === "month") setAnchor(d => subMonths(d, 1));
    else setAnchor(d => subYears(d, 1));
  };
  const handleNext = () => {
    if (range === "day") setAnchor(d => addDays(d, 1));
    else if (range === "week") setAnchor(d => addWeeks(d, 1));
    else if (range === "month") setAnchor(d => addMonths(d, 1));
    else setAnchor(d => addYears(d, 1));
  };

  // Punkt-Klick → Drilldown-Card
  const handleClick = async (e: { activePayload?: Array<{ payload: Point }> } | null) => {
    if (!e?.activePayload?.[0]) return;
    const p = e.activePayload[0].payload;
    const d = new Date(p.date);
    setSelected(d);
    const dateStr = fmtDate(d);
    const [log, todos, events] = await Promise.all([
      dataApi.getLog(userId, dateStr),
      dataApi.getTodos(userId, dateStr),
      dataApi.getEventsForDate(userId, dateStr),
    ]);
    setSelectedLog(log);
    setSelectedTodos(todos);
    setSelectedEvents(events);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrev} aria-label="Zurück"><ChevronLeft className="h-4 w-4" /></Button>
          <h4 className="text-base px-2 min-w-[200px] text-center capitalize">{viewLabel}</h4>
          <Button variant="ghost" size="icon" onClick={handleNext} aria-label="Vor"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-full p-1">
          {RANGES.map(r => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer>
          <LineChart data={data} onClick={handleClick} margin={{ top: 10, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(v) => ENERGY_LABELS[v - 1] ?? ""} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [v ? `${ENERGY_LABELS[v - 1]} (${v}/5)` : "—", "Energie"]}
              labelFormatter={(l) => l}
            />
            <ReferenceLine y={3} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <Line
              type="monotone"
              dataKey="energy"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Tipp: Klicke einen Punkt an, um die Tagesdetails zu sehen.
      </p>

      {selected && (
        <Card className="p-4 space-y-3 border-primary/30">
          <div className="flex items-center justify-between">
            <h4 className="font-medium capitalize">{format(selected, "EEEE, d. MMMM yyyy", { locale: de })}</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Schließen</Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/40">
              <div className="text-xs text-muted-foreground mb-1">Energie</div>
              <div className="font-medium capitalize">
                {selectedLog?.energy_level
                  ? `${ENERGY_LABELS[(energyToNum(selectedLog.energy_level) ?? 3) - 1]} (${energyToNum(selectedLog.energy_level)}/5)`
                  : "Nicht erfasst"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <div className="text-xs text-muted-foreground mb-1">Beschwerden</div>
              <div className="font-medium">
                {selectedLog?.symptoms?.length ? selectedLog.symptoms.join(", ") : "Keine"}
              </div>
            </div>
          </div>

          {selectedLog?.notes && (
            <div className="p-3 rounded-lg bg-muted/40 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Notiz an mich</div>
              <div className="whitespace-pre-wrap">{selectedLog.notes}</div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/40">
              <div className="text-xs text-muted-foreground mb-2">Termine</div>
              {selectedEvents.length === 0
                ? <div className="italic text-muted-foreground">Keine</div>
                : <ul className="space-y-1">{selectedEvents.map(e => (
                    <li key={e.id} className="truncate">
                      • {e.title}
                      <span className="text-muted-foreground text-xs ml-1">
                        {e.all_day ? "ganztägig" : format(new Date(e.starts_at), "HH:mm")}
                      </span>
                    </li>
                  ))}</ul>}
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <div className="text-xs text-muted-foreground mb-2">To-dos</div>
              {selectedTodos.length === 0
                ? <div className="italic text-muted-foreground">Keine</div>
                : <ul className="space-y-1">{selectedTodos.map(t => (
                    <li key={t.id} className={cn("truncate", t.completed && "line-through text-muted-foreground")}>• {t.title}</li>
                  ))}</ul>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Helpers ----

async function fetchLogsBulk(userId: string | null, fromDate: string, toDate: string): Promise<DailyLog[]> {
  // Verwende die SDK-Funktion direkt: getLog ist pro Tag — wir bauen einen einfachen Range-Loader.
  // Für Supabase: filter, für Guest: alle aus Store.
  const { isGuest, guestStore } = await import("@/lib/guestStore");
  if (isGuest()) {
    return guestStore.getLogs()
      .filter(l => l.log_date >= fromDate && l.log_date <= toDate)
      .map(l => ({ ...l, symptoms: l.symptoms ?? [] }));
  }
  if (!userId) return [];
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", fromDate)
    .lte("log_date", toDate)
    .order("log_date");
  return (data as DailyLog[]) ?? [];
}

function buildSeries(range: Range, anchor: Date, logs: DailyLog[]): { data: Point[]; domain: [Date, Date]; viewLabel: string } {
  const logsByDay = new Map<string, DailyLog>();
  logs.forEach(l => logsByDay.set(l.log_date, l));

  if (range === "day") {
    // Einzelner Tag: zeige diesen Tag + 6 Tage drumherum (kontextuelle Mini-Serie)
    const start = subDays(anchor, 3);
    const end = addDays(anchor, 3);
    const days = eachDayOfInterval({ start, end });
    return {
      data: days.map(d => {
        const log = logsByDay.get(fmtDate(d));
        return { date: fmtDate(d), label: format(d, "EEE d.", { locale: de }), energy: energyToNum(log?.energy_level), raw: log };
      }),
      domain: [start, end],
      viewLabel: format(anchor, "EEEE, d. MMMM yyyy", { locale: de }),
    };
  }

  if (range === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    return {
      data: days.map(d => {
        const log = logsByDay.get(fmtDate(d));
        return { date: fmtDate(d), label: format(d, "EEE d.", { locale: de }), energy: energyToNum(log?.energy_level), raw: log };
      }),
      domain: [start, end],
      viewLabel: `KW ${format(anchor, "I", { locale: de })} · ${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`,
    };
  }

  if (range === "month") {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const days = eachDayOfInterval({ start, end });
    return {
      data: days.map(d => {
        const log = logsByDay.get(fmtDate(d));
        return { date: fmtDate(d), label: format(d, "d.", { locale: de }), energy: energyToNum(log?.energy_level), raw: log };
      }),
      domain: [start, end],
      viewLabel: format(anchor, "MMMM yyyy", { locale: de }),
    };
  }

  // year: Wochenmittelwerte über 52 Wochen
  const start = startOfYear(anchor);
  const end = endOfYear(anchor);
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  return {
    data: weeks.map(wkStart => {
      const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: wkStart, end: wkEnd });
      const vals = days.map(d => energyToNum(logsByDay.get(fmtDate(d))?.energy_level)).filter((v): v is number => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        date: fmtDate(wkStart),
        label: format(wkStart, "MMM", { locale: de }),
        energy: avg !== null ? Math.round(avg * 10) / 10 : null,
      };
    }),
    domain: [start, end],
    viewLabel: format(anchor, "yyyy"),
  };
}
