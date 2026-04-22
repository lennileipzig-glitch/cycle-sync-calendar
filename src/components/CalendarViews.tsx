import { addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { phaseForDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";
import type { GuestEvent } from "@/lib/guestStore";
import { fmtDate } from "@/lib/cycle";
import { CheckCircle2, Circle } from "lucide-react";

const phaseStripe: Record<string, string> = {
  menstrual: "bg-phase-menstrual",
  follicular: "bg-phase-follicular",
  ovulation: "bg-phase-ovulation",
  luteal: "bg-phase-luteal",
  unknown: "bg-transparent",
};

const phaseFill: Record<string, string> = {
  menstrual: "bg-phase-menstrual/40",
  follicular: "bg-phase-follicular/35",
  ovulation: "bg-phase-ovulation/35",
  luteal: "bg-phase-luteal/35",
  unknown: "bg-muted/30",
};

interface DataMaps {
  eventsByDay?: Record<string, GuestEvent[]>;
  todosByDay?: Record<string, { id: string; completed: boolean }[]>;
}

interface MonthProps extends DataMaps {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  profile: Profile | null;
}

export function MonthView({ monthDate, selectedDate, onSelectDate, profile, eventsByDay = {}, todosByDay = {} }: MonthProps) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-muted-foreground text-center font-medium">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          const inMonth = isSameMonth(d, monthDate);
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const key = fmtDate(d);
          const events = eventsByDay[key] ?? [];
          const todos = todosByDay[key] ?? [];
          const openTodos = todos.filter(t => !t.completed).length;
          return (
            <button key={d.toISOString()} onClick={() => onSelectDate(d)}
              className={cn(
                "aspect-square rounded-lg overflow-hidden flex flex-col text-sm transition-all relative bg-card border border-border/40",
                !inMonth && "opacity-40",
                selected && "ring-2 ring-primary shadow-soft",
                !selected && "hover:border-primary/40",
              )}>
              {/* Phasen-Streifen oben */}
              <div className={cn("h-1.5 w-full shrink-0", phaseStripe[phase])} />
              {/* Datum oben rechts */}
              <div className="flex justify-end px-1.5 pt-1">
                <span className={cn(
                  "text-xs leading-none",
                  isToday && "font-bold text-primary",
                )}>{format(d, "d")}</span>
              </div>
              {/* Indikatoren unten */}
              <div className="flex-1 flex items-end justify-center gap-1 px-1 pb-1">
                {events.slice(0, 3).map((e, i) => (
                  <div key={i} className="h-1 w-1 rounded-full bg-foreground/60" />
                ))}
                {openTodos > 0 && (
                  <div className="h-1 w-1 rounded-full bg-primary" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface WeekProps extends DataMaps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  profile: Profile | null;
  moodByDay?: Record<string, { energy?: string | null; symptoms?: string[] }>;
  onSelectEvent?: (e: GuestEvent) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 – 21:00
const ROW_HEIGHT = 44; // px pro Stunde
const ENERGY_LABEL: Record<string, string> = {
  "1": "sehr schlecht", "2": "schlecht", "3": "mittel", "4": "gut", "5": "sehr gut",
  niedrig: "schlecht", mittel: "mittel", hoch: "gut",
};

export function WeekView({ selectedDate, onSelectDate, profile, eventsByDay = {}, moodByDay = {} }: WeekProps) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();

  return (
    <div className="animate-fade-in">
      {/* Kopfzeile: Wochentage mit Phasenstreifen + Stimmungsbild */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1 mb-2">
        <div />
        {days.map(d => {
          const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const key = fmtDate(d);
          const m = moodByDay[key];
          return (
            <button key={d.toISOString()} onClick={() => onSelectDate(d)}
              className={cn(
                "rounded-lg overflow-hidden bg-card border border-border/40 transition-all",
                selected && "ring-2 ring-primary shadow-soft",
                !selected && "hover:border-primary/40",
              )}>
              <div className={cn("h-1.5 w-full", phaseStripe[phase])} />
              <div className="px-2 py-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(d, "EE", { locale: de })}</span>
                  <span className={cn("text-base", isToday && "font-bold text-primary")}>{format(d, "d")}</span>
                </div>
                {m?.energy && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {ENERGY_LABEL[m.energy] ?? m.energy}
                  </div>
                )}
                {m?.symptoms && m.symptoms.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {m.symptoms.slice(0, 3).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-foreground/40" />
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Stundenraster */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1 relative">
        {/* Zeit-Spalte */}
        <div className="flex flex-col">
          {HOURS.map(h => (
            <div key={h} style={{ height: ROW_HEIGHT }} className="text-[10px] text-muted-foreground text-right pr-1 -mt-1.5">
              {h}:00
            </div>
          ))}
        </div>
        {days.map(d => {
          const key = fmtDate(d);
          const events = eventsByDay[key] ?? [];
          const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          return (
            <div key={d.toISOString()} className="relative bg-card/50 rounded-lg border border-border/30">
              {HOURS.map(h => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="border-t border-border/30 first:border-t-0" />
              ))}
              {events.map(ev => {
                const startD = new Date(ev.starts_at);
                const endD = ev.ends_at ? new Date(ev.ends_at) : new Date(startD.getTime() + 60 * 60 * 1000);
                if (ev.all_day) {
                  return (
                    <div key={ev.id} className={cn("absolute inset-x-0.5 top-0.5 px-1.5 py-0.5 rounded text-[10px] truncate", phaseFill[phase])}>
                      {ev.title}
                    </div>
                  );
                }
                const startH = startD.getHours() + startD.getMinutes() / 60;
                const endH = endD.getHours() + endD.getMinutes() / 60;
                const top = (startH - HOURS[0]) * ROW_HEIGHT;
                const height = Math.max(20, (endH - startH) * ROW_HEIGHT);
                if (top < 0 || top > HOURS.length * ROW_HEIGHT) return null;
                return (
                  <div
                    key={ev.id}
                    className={cn("absolute inset-x-0.5 px-1.5 py-1 rounded text-[10px] overflow-hidden border-l-2", phaseFill[phase])}
                    style={{ top, height, borderLeftColor: `hsl(var(--phase-${phase}))` }}
                  >
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {format(startD, "HH:mm")}{ev.ends_at && `–${format(endD, "HH:mm")}`}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearView({ selectedDate, onSelectDate, profile }: { selectedDate: Date; onSelectDate: (d: Date) => void; profile: Profile | null }) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(selectedDate.getFullYear(), i, 1));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
      {months.map(m => {
        const start = startOfWeek(startOfMonth(m), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(m), { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });
        return (
          <button key={m.toISOString()} onClick={() => onSelectDate(m)}
            className="bg-card rounded-2xl p-3 hover:shadow-elevated transition-all text-left">
            <div className="text-sm font-medium mb-2 capitalize">{format(m, "MMMM", { locale: de })}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map(d => {
                const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
                return <div key={d.toISOString()} className={cn("aspect-square rounded-sm", phaseFill[phase], !isSameMonth(d, m) && "opacity-20")} />;
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface DayProps extends DataMaps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  profile: Profile | null;
  events: GuestEvent[];
  todos: { id: string; title: string; completed: boolean }[];
  log: { energy_level?: string | null; symptoms?: string[] | null; notes?: string | null } | null;
  onToggleTodo: (id: string, completed: boolean) => void;
  onOpenTracker: () => void;
}

const energyToNum = (raw?: string | null) => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  if (raw === "niedrig") return 2;
  if (raw === "hoch") return 4;
  if (raw === "mittel") return 3;
  return null;
};

export function DayView({ selectedDate, onSelectDate, profile, events, todos, log, onToggleTodo, onOpenTracker }: DayProps) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();
  const energy = energyToNum(log?.energy_level);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Mini-Strip oben */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          return (
            <button key={d.toISOString()} onClick={() => onSelectDate(d)}
              className={cn(
                "rounded-lg overflow-hidden bg-card border border-border/40 transition-all",
                selected && "ring-2 ring-primary",
                !selected && "hover:border-primary/40 opacity-70",
              )}>
              <div className={cn("h-1 w-full", phaseStripe[phase])} />
              <div className="py-1">
                <div className="text-[9px] uppercase text-muted-foreground">{format(d, "EE", { locale: de })}</div>
                <div className={cn("text-sm", isToday && "font-bold text-primary")}>{format(d, "d")}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail-Kacheln */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Energielevel */}
        <button
          onClick={onOpenTracker}
          className="rounded-xl bg-card border border-border/60 p-4 text-left hover:border-primary/40 transition-all"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Energielevel</div>
          {energy !== null ? (
            <>
              <div className="text-2xl mb-2">
                {["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"][energy - 1]}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={cn("h-2 flex-1 rounded-full", i <= energy ? "bg-primary" : "bg-muted")} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Noch nicht eingetragen — tippen zum Tracken</div>
          )}
        </button>

        {/* Beschwerden */}
        <button
          onClick={onOpenTracker}
          className="rounded-xl bg-card border border-border/60 p-4 text-left hover:border-primary/40 transition-all"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Beschwerden</div>
          {log?.symptoms && log.symptoms.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {log.symptoms.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-muted rounded-full">{s}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Keine eingetragen</div>
          )}
        </button>

        {/* Termine */}
        <div className="rounded-xl bg-card border border-border/60 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Termine</div>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Termine.</div>
          ) : (
            <ul className="space-y-2">
              {events.map(e => (
                <li key={e.id} className="text-sm">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.all_day ? "Ganztägig" : format(new Date(e.starts_at), "HH:mm")}
                    {e.location && ` · ${e.location}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* To-dos */}
        <div className="rounded-xl bg-card border border-border/60 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">To-dos</div>
          {todos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Aufgaben.</div>
          ) : (
            <ul className="space-y-1.5">
              {todos.map(t => (
                <li key={t.id}>
                  <button onClick={() => onToggleTodo(t.id, !t.completed)} className="flex items-center gap-2 text-sm w-full text-left">
                    {t.completed
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={cn(t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {log?.notes && (
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notiz an mich</div>
          <p className="text-sm whitespace-pre-wrap">{log.notes}</p>
        </div>
      )}
    </div>
  );
}
