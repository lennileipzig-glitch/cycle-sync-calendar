import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, CalendarDays, ListTodo, StickyNote, Activity } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  format, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  startOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear, endOfWeek,
  eachDayOfInterval, eachWeekOfInterval, subYears as subY,
} from "date-fns";
import { de } from "date-fns/locale";
import { dataApi, type DailyLog } from "@/lib/dataApi";
import { fmtDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";

type Range = "week" | "month" | "year";
const RANGES: Range[] = ["week", "month", "year"];
const RANGE_LABELS: Record<Range, string> = { week: "Woche", month: "Monat", year: "Jahr" };
const ENERGY_LABELS = ["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"];
const ENERGY_SHORT = ["😞", "😕", "😐", "🙂", "🤩"];
const ENERGY_AXIS = ["sehr\nschlecht", "schlecht", "mittel", "gut", "sehr\ngut"];

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const end = new Date();
      const start = subY(end, 2);
      const all = await fetchLogsBulk(userId, fmtDate(start), fmtDate(end));
      if (cancelled) return;
      setLogs(all);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const { data, viewLabel, stats } = useMemo(() => buildSeries(range, anchor, logs), [range, anchor, logs]);

  const handlePrev = () => {
    if (range === "week") setAnchor(d => subWeeks(d, 1));
    else if (range === "month") setAnchor(d => subMonths(d, 1));
    else setAnchor(d => subYears(d, 1));
  };
  const handleNext = () => {
    if (range === "week") setAnchor(d => addWeeks(d, 1));
    else if (range === "month") setAnchor(d => addMonths(d, 1));
    else setAnchor(d => addYears(d, 1));
  };

  const handleClick = async (e: { activePayload?: Array<{ payload: Point }> } | null) => {
    if (!e?.activePayload?.[0]) return;
    const p = e.activePayload[0].payload;
    if (range === "year") return; // Jahresansicht: keine Tagesdetails
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
    <div className="space-y-5">
      {/* Header: Navigation + Range Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrev} aria-label="Zurück" className="h-8 w-8 rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className="text-sm font-medium px-2 min-w-[180px] text-center capitalize tracking-tight">{viewLabel}</h4>
          <Button variant="ghost" size="icon" onClick={handleNext} aria-label="Vor" className="h-8 w-8 rounded-full">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/60 backdrop-blur rounded-full p-1 border border-border/50">
          {RANGES.map(r => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              className={cn("rounded-full h-7 px-4 text-xs transition-all", range === r && "shadow-sm")}
              onClick={() => { setRange(r); setSelected(null); }}
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill label="Ø Energie" value={stats.avg !== null ? `${stats.avg.toFixed(1)}/5` : "—"} icon={<Activity className="h-3.5 w-3.5" />} />
        <StatPill label={range === "year" ? "Bester Monat" : "Bester Tag"} value={stats.bestLabel ?? "—"} accent />
        <StatPill label="Erfasst" value={`${stats.tracked}/${stats.total}`} />
      </div>

      {/* Chart */}
      <Card className="p-3 pt-5 bg-gradient-to-br from-card via-card to-primary/[0.03] border-border/60 shadow-sm">
        <div className="h-[260px] w-full">
          <ResponsiveContainer>
            <AreaChart data={data} onClick={handleClick} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={(v) => ENERGY_LABELS[v - 1] ?? ""}
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={68}
                interval={0}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.4 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.15)",
                  padding: "8px 12px",
                }}
                formatter={(v: number) => [v ? `${ENERGY_SHORT[Math.round(v) - 1]} ${ENERGY_LABELS[Math.round(v) - 1]} (${v}/5)` : "—", "Energie"]}
                labelFormatter={(l) => l}
              />
              <ReferenceLine y={3} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" opacity={0.4} />
              <Area
                type="monotone"
                dataKey="energy"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#energyFill)"
                dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {range !== "year" && (
          <p className="text-[10px] text-muted-foreground/80 text-center mt-2 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" /> Tippe einen Punkt für Tagesdetails
          </p>
        )}
      </Card>

      {/* Drilldown */}
      {selected && (
        <Card className="p-5 space-y-4 border-primary/30 bg-gradient-to-br from-card to-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-primary/70 font-medium">Tagesdetails</div>
              <h4 className="font-medium capitalize text-base mt-0.5">{format(selected, "EEEE, d. MMMM yyyy", { locale: de })}</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="rounded-full">Schließen</Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <DetailTile
              icon={<Activity className="h-4 w-4" />}
              label="Energie"
              value={selectedLog?.energy_level
                ? `${ENERGY_SHORT[(energyToNum(selectedLog.energy_level) ?? 3) - 1]} ${ENERGY_LABELS[(energyToNum(selectedLog.energy_level) ?? 3) - 1]} (${energyToNum(selectedLog.energy_level)}/5)`
                : "Nicht erfasst"}
            />
            <DetailTile
              icon={<Sparkles className="h-4 w-4" />}
              label="Beschwerden"
              value={selectedLog?.symptoms?.length ? selectedLog.symptoms.join(", ") : "Keine"}
            />
          </div>

          {selectedLog?.notes && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notiz an mich
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{selectedLog.notes}</div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Termine
              </div>
              {selectedEvents.length === 0
                ? <div className="italic text-muted-foreground text-xs">Keine</div>
                : <ul className="space-y-1">{selectedEvents.map(e => (
                    <li key={e.id} className="truncate text-sm">
                      • {e.title}
                      <span className="text-muted-foreground text-xs ml-1">
                        {e.all_day ? "ganztägig" : format(new Date(e.starts_at), "HH:mm")}
                      </span>
                    </li>
                  ))}</ul>}
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5" /> To-dos
              </div>
              {selectedTodos.length === 0
                ? <div className="italic text-muted-foreground text-xs">Keine</div>
                : <ul className="space-y-1">{selectedTodos.map(t => (
                    <li key={t.id} className={cn("truncate text-sm", t.completed && "line-through text-muted-foreground")}>• {t.title}</li>
                  ))}</ul>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Subcomponents ----

function StatPill({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl px-3 py-2.5 border transition-colors",
      accent ? "bg-primary/10 border-primary/30" : "bg-muted/40 border-border/50"
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={cn("text-sm font-semibold mt-0.5 truncate", accent && "text-primary")}>{value}</div>
    </div>
  );
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {icon}{label}
      </div>
      <div className="font-medium capitalize text-sm">{value}</div>
    </div>
  );
}

// ---- Helpers ----

async function fetchLogsBulk(userId: string | null, fromDate: string, toDate: string): Promise<DailyLog[]> {
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

interface SeriesResult {
  data: Point[];
  viewLabel: string;
  stats: { avg: number | null; bestLabel: string | null; tracked: number; total: number };
}

function buildSeries(range: Range, anchor: Date, logs: DailyLog[]): SeriesResult {
  const logsByDay = new Map<string, DailyLog>();
  logs.forEach(l => logsByDay.set(l.log_date, l));

  let data: Point[] = [];
  let viewLabel = "";

  if (range === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    data = days.map(d => {
      const log = logsByDay.get(fmtDate(d));
      return { date: fmtDate(d), label: format(d, "EEE d.", { locale: de }), energy: energyToNum(log?.energy_level), raw: log };
    });
    viewLabel = `KW ${format(anchor, "I", { locale: de })} · ${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  } else if (range === "month") {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const days = eachDayOfInterval({ start, end });
    data = days.map(d => {
      const log = logsByDay.get(fmtDate(d));
      return { date: fmtDate(d), label: format(d, "d.", { locale: de }), energy: energyToNum(log?.energy_level), raw: log };
    });
    viewLabel = format(anchor, "MMMM yyyy", { locale: de });
  } else {
    const start = startOfYear(anchor);
    const end = endOfYear(anchor);
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    data = weeks.map(wkStart => {
      const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: wkStart, end: wkEnd });
      const vals = days.map(d => energyToNum(logsByDay.get(fmtDate(d))?.energy_level)).filter((v): v is number => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        date: fmtDate(wkStart),
        label: format(wkStart, "MMM", { locale: de }),
        energy: avg !== null ? Math.round(avg * 10) / 10 : null,
      };
    });
    viewLabel = format(anchor, "yyyy");
  }

  // Stats
  const valid = data.filter(p => p.energy !== null) as (Point & { energy: number })[];
  const avg = valid.length ? valid.reduce((s, p) => s + p.energy, 0) / valid.length : null;

  let bestLabel: string | null = null;
  if (range === "year") {
    // Bester Monat = Monat mit höchstem Tagesdurchschnitt im Jahr
    const yearStart = startOfYear(anchor);
    const yearEnd = endOfYear(anchor);
    const monthBuckets = new Map<number, number[]>();
    logs.forEach(l => {
      const d = new Date(l.log_date);
      if (d < yearStart || d > yearEnd) return;
      const v = energyToNum(l.energy_level);
      if (v === null) return;
      const m = d.getMonth();
      if (!monthBuckets.has(m)) monthBuckets.set(m, []);
      monthBuckets.get(m)!.push(v);
    });
    let bestM = -1; let bestAvg = -Infinity;
    monthBuckets.forEach((vals, m) => {
      const a = vals.reduce((s, x) => s + x, 0) / vals.length;
      if (a > bestAvg) { bestAvg = a; bestM = m; }
    });
    if (bestM >= 0) {
      const monthDate = new Date(anchor.getFullYear(), bestM, 1);
      bestLabel = format(monthDate, "MMMM", { locale: de });
    }
  } else {
    const best = valid.reduce<(Point & { energy: number }) | null>((acc, p) => (!acc || p.energy > acc.energy) ? p : acc, null);
    bestLabel = best ? format(new Date(best.date), "d. MMM", { locale: de }) : null;
  }

  return {
    data,
    viewLabel,
    stats: { avg, bestLabel, tracked: valid.length, total: data.length },
  };
}
