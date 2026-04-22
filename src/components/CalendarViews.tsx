import { addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { phaseForDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";
import type { GuestEvent, EventCategory } from "@/lib/guestStore";
import { fmtDate } from "@/lib/cycle";
import { CheckCircle2, Circle, Plus, CalendarPlus, ListPlus, UtensilsCrossed, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const categoryIcon = (cat?: EventCategory) => {
  if (cat === "mahlzeit") return UtensilsCrossed;
  if (cat === "sport") return Dumbbell;
  return null;
};
const categoryAccent = (cat?: EventCategory): string => {
  if (cat === "mahlzeit") return "border-l-amber-400 bg-amber-100/30 dark:bg-amber-400/10";
  if (cat === "sport") return "border-l-emerald-500 bg-emerald-100/30 dark:bg-emerald-400/10";
  return "";
};

interface DataMaps {
  eventsByDay?: Record<string, GuestEvent[]>;
  todosByDay?: Record<string, { id: string; title: string; completed: boolean }[]>;
}

interface QuickAdd {
  onAddEventForDate?: (d: Date) => void;
  onAddTodoForDate?: (d: Date) => void;
  /** Optional: Termin an einem bestimmten Tag + Uhrzeit (HH:mm) anlegen */
  onAddEventAtTime?: (d: Date, time: string) => void;
  /** Optional: Mahlzeit für einen Tag hinzufügen (öffnet Dialog mit Kategorie="mahlzeit") */
  onAddMealForDate?: (d: Date) => void;
  /** Optional: Drag & Drop – Event auf neues Datum verschieben */
  onMoveEvent?: (event: GuestEvent, newDateStr: string) => void;
}

function QuickAddMenu({ date, onAddEventForDate, onAddTodoForDate, onAddMealForDate, size = "sm" }: QuickAdd & { date: Date; size?: "sm" | "xs" }) {
  if (!onAddEventForDate && !onAddTodoForDate && !onAddMealForDate) return null;
  const px = size === "xs" ? "h-5 w-5" : "h-7 w-7";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Hinzufügen"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-background/70 hover:bg-primary hover:text-primary-foreground border border-border/60 transition-colors",
            px,
          )}
        >
          <Plus className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onAddEventForDate && (
          <DropdownMenuItem onClick={() => onAddEventForDate(date)}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Termin
          </DropdownMenuItem>
        )}
        {onAddMealForDate && (
          <DropdownMenuItem onClick={() => onAddMealForDate(date)}>
            <UtensilsCrossed className="h-4 w-4 mr-2" /> Mahlzeit
          </DropdownMenuItem>
        )}
        {onAddTodoForDate && (
          <DropdownMenuItem onClick={() => onAddTodoForDate(date)}>
            <ListPlus className="h-4 w-4 mr-2" /> Aufgabe
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MonthProps extends DataMaps, QuickAdd {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  profile: Profile | null;
}

export function MonthView({ monthDate, selectedDate, onSelectDate, profile, eventsByDay = {}, todosByDay = {}, onAddEventForDate, onAddTodoForDate, onAddMealForDate, onMoveEvent }: MonthProps) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();

  const dragHandlers = (d: Date) => onMoveEvent ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/x-luna-event");
      if (!data) return;
      try {
        const ev = JSON.parse(data) as GuestEvent;
        onMoveEvent(ev, fmtDate(d));
      } catch { /* ignore */ }
    },
  } : {};

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
          const phaseColorVar = `hsl(var(--phase-${phase}))`;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "group min-h-[5.5rem] rounded-lg overflow-hidden flex flex-col text-sm transition-all relative bg-card border border-border/40 cursor-pointer",
                !inMonth && "opacity-40",
                selected && "ring-2 ring-primary shadow-soft",
                isToday && !selected && "ring-2 ring-primary/70 border-primary/40 bg-primary/5",
                !selected && !isToday && "hover:border-primary/40",
              )}
              onClick={() => onSelectDate(d)}
              role="button"
              tabIndex={0}
              {...dragHandlers(d)}
            >
              <div className={cn("h-1.5 w-full shrink-0", phaseStripe[phase])} />
              <div className="flex justify-between items-center px-1.5 pt-1">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <QuickAddMenu date={d} onAddEventForDate={onAddEventForDate} onAddTodoForDate={onAddTodoForDate} onAddMealForDate={onAddMealForDate} size="xs" />
                </div>
                {isToday ? (
                  <span className="text-xs leading-none inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground font-bold">
                    {format(d, "d")}
                  </span>
                ) : (
                  <span className="text-xs leading-none">{format(d, "d")}</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-0.5 px-1 pb-1 mt-1 overflow-hidden">
                {events.slice(0, 2).map((e) => {
                  const Icon = categoryIcon(e.category);
                  const draggable = !e._shared_owner_name && !!onMoveEvent;
                  return (
                    <div
                      key={e.id}
                      draggable={draggable}
                      onDragStart={draggable ? (ev) => {
                        ev.stopPropagation();
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("application/x-luna-event", JSON.stringify(e));
                      } : undefined}
                      className={cn(
                        "text-[9px] leading-tight px-1 py-0.5 rounded truncate text-left border-l-2 flex items-center gap-1",
                        e._shared_owner_name && "border-dashed",
                        draggable && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{ background: `${phaseColorVar.replace(')', ' / 0.18)')}`, borderLeftColor: phaseColorVar }}
                      title={e._shared_owner_name ? `${e.title} · von ${e._shared_owner_name}` : e.title}
                    >
                      {Icon && <Icon className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                      {!e.all_day && (
                        <span className="text-muted-foreground">
                          {format(new Date(e.starts_at), "HH:mm")}
                        </span>
                      )}
                      <span className="truncate">{e.title}</span>
                      {e._shared_owner_name && <span className="opacity-60"> · {e._shared_owner_name}</span>}
                    </div>
                  );
                })}
                {events.length > 2 && (
                  <div className="text-[9px] text-muted-foreground px-1">+{events.length - 2} weitere</div>
                )}
                {openTodos > 0 && (
                  <div className="flex items-center gap-1 mt-auto px-1">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    <span className="text-[9px] text-muted-foreground">{openTodos} offen</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WeekProps extends DataMaps, QuickAdd {
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

const energyToFloat = (raw?: string | null): number | null => {
  if (!raw) return null;
  const n = parseFloat(raw);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  if (raw === "niedrig") return 2;
  if (raw === "hoch") return 4;
  if (raw === "mittel") return 3;
  return null;
};

export function WeekView({ selectedDate, onSelectDate, profile, eventsByDay = {}, moodByDay = {}, todosByDay = {}, onAddEventForDate, onAddTodoForDate, onAddEventAtTime, onAddMealForDate, onMoveEvent }: WeekProps) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();

  const dropProps = (d: Date) => onMoveEvent ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/x-luna-event");
      if (!data) return;
      try { onMoveEvent(JSON.parse(data) as GuestEvent, fmtDate(d)); } catch { /* ignore */ }
    },
  } : {};

  return (
    <div className="animate-fade-in space-y-2">
      {/* Kopfzeile: Wochentage mit Phasenstreifen + Stimmungsbild + Quick-Add */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
        <div />
        {days.map(d => {
          const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const key = fmtDate(d);
          const m = moodByDay[key];
          return (
            <div
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={cn(
                "group rounded-lg overflow-hidden bg-card border border-border/40 transition-all cursor-pointer",
                selected && "ring-2 ring-primary shadow-soft",
                isToday && !selected && "ring-2 ring-primary/70 border-primary/40 bg-primary/5",
                !selected && !isToday && "hover:border-primary/40",
              )}
              role="button"
              tabIndex={0}
              {...dropProps(d)}
            >
              <div className={cn("h-1.5 w-full", phaseStripe[phase])} />
              <div className="px-2 py-1.5 relative">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(d, "EE", { locale: de })}</span>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {format(d, "d")}
                    </span>
                  ) : (
                    <span className="text-base">{format(d, "d")}</span>
                  )}
                </div>
                {m?.symptoms && m.symptoms.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {m.symptoms.slice(0, 3).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-foreground/40" />
                    ))}
                  </div>
                )}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <QuickAddMenu date={d} onAddEventForDate={onAddEventForDate} onAddTodoForDate={onAddTodoForDate} onAddMealForDate={onAddMealForDate} size="xs" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Energielevel-Zeile für die ganze Woche */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1 items-stretch">
        <div className="text-[10px] text-muted-foreground self-center text-right pr-1 leading-tight">
          Energie
        </div>
        {days.map(d => {
          const key = fmtDate(d);
          const energy = energyToFloat(moodByDay[key]?.energy);
          const pct = energy !== null ? ((energy - 1) / 4) * 100 : 0;
          return (
            <div key={d.toISOString()} className="rounded-md bg-muted/40 border border-border/30 h-10 relative overflow-hidden flex items-end justify-center">
              {energy !== null ? (
                <>
                  <div
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/70 to-primary/30 transition-all"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="relative text-[10px] tabular-nums text-foreground/80 mb-0.5 px-1 rounded bg-background/60">
                    {energy.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-[9px] text-muted-foreground/60 self-center">—</span>
              )}
            </div>
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
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "relative bg-card/50 rounded-lg border border-border/30",
                isToday && "bg-primary/5 border-primary/40 ring-1 ring-primary/30",
              )}
            >
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const minutes = Math.round(((offsetY / ROW_HEIGHT) * 60) / 15) * 15;
                    const mm = Math.min(45, Math.max(0, minutes));
                    const time = `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
                    if (onAddEventAtTime) onAddEventAtTime(d, time);
                    else onAddEventForDate?.(d);
                  }}
                  style={{ height: ROW_HEIGHT }}
                  className="block w-full border-t border-border/30 first:border-t-0 hover:bg-primary/10 transition-colors group/slot relative text-left"
                  aria-label={`Termin am ${format(d, "EEEE", { locale: de })} um ${h}:00 hinzufügen`}
                >
                  <span className="absolute top-0.5 right-1 text-[9px] text-primary opacity-0 group-hover/slot:opacity-100 transition-opacity">
                    + Termin
                  </span>
                </button>
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

      {/* Post-It Reihe für Todos pro Tag */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1 pt-1">
        <div className="text-[10px] text-muted-foreground self-start text-right pr-1 pt-1 leading-tight">
          To-dos
        </div>
        {days.map(d => {
          const key = fmtDate(d);
          const todos = todosByDay[key] ?? [];
          return (
            <div key={d.toISOString()} className="min-h-[3rem]">
              {todos.length === 0 ? (
                <button
                  onClick={() => onAddTodoForDate?.(d)}
                  className="w-full h-full min-h-[3rem] rounded-md border border-dashed border-border/50 text-[10px] text-muted-foreground/60 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center"
                  aria-label="Aufgabe hinzufügen"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : (
                <div
                  className="rounded-md p-1.5 shadow-sm border bg-accent/50 border-accent"
                  style={{ transform: "rotate(-0.5deg)" }}
                >
                  <ul className="space-y-0.5">
                    {todos.slice(0, 3).map(t => (
                      <li key={t.id} className={cn("text-[10px] leading-tight truncate", t.completed && "line-through opacity-60")}>
                        • {t.title}
                      </li>
                    ))}
                    {todos.length > 3 && (
                      <li className="text-[9px] text-muted-foreground">+{todos.length - 3} weitere</li>
                    )}
                  </ul>
                </div>
              )}
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
  const today = new Date();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
      {months.map(m => {
        const start = startOfWeek(startOfMonth(m), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(m), { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });
        const isCurrentMonth = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
        return (
          <button key={m.toISOString()} onClick={() => onSelectDate(m)}
            className={cn(
              "bg-card rounded-2xl p-3 hover:shadow-elevated transition-all text-left",
              isCurrentMonth && "ring-2 ring-primary bg-primary/5",
            )}>
            <div className={cn("text-sm font-medium mb-2 capitalize flex items-center gap-1.5", isCurrentMonth && "text-primary")}>
              {format(m, "MMMM", { locale: de })}
              {isCurrentMonth && <span className="text-[9px] uppercase tracking-wider px-1.5 py-px rounded-full bg-primary text-primary-foreground">heute</span>}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map(d => {
                const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "aspect-square rounded-sm relative",
                      phaseFill[phase],
                      !isSameMonth(d, m) && "opacity-20",
                      isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card z-10",
                    )}
                  />
                );
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
  onAddEvent?: () => void;
  onAddTodo?: () => void;
  onEditEvent?: (e: GuestEvent) => void;
}

const energyToNum = (raw?: string | null) => energyToFloat(raw);

export function DayView({ selectedDate, onSelectDate, profile, events, todos, log, onToggleTodo, onOpenTracker, onAddEvent, onAddTodo, onEditEvent }: DayProps) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();
  const energy = energyToNum(log?.energy_level);
  const phase = phaseForDate(selectedDate, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Großer Tages-Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn("h-12 w-1.5 rounded-full", phaseStripe[phase])} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {format(selectedDate, "EEEE", { locale: de })}
            </div>
            <div className="text-2xl leading-tight">
              {format(selectedDate, "d. MMMM yyyy", { locale: de })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAddEvent && (
            <Button size="sm" variant="outline" onClick={onAddEvent}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Termin
            </Button>
          )}
          {onAddTodo && (
            <Button size="sm" variant="outline" onClick={onAddTodo}>
              <ListPlus className="h-4 w-4 mr-1" /> Aufgabe
            </Button>
          )}
        </div>
      </div>

      {/* Mini-Strip Wochennavigation */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const ph = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          return (
            <button key={d.toISOString()} onClick={() => onSelectDate(d)}
              className={cn(
                "rounded-lg overflow-hidden bg-card border border-border/40 transition-all",
                selected && "ring-2 ring-primary",
                isToday && !selected && "ring-2 ring-primary/70 border-primary/40 bg-primary/5",
                !selected && !isToday && "hover:border-primary/40 opacity-70",
              )}>
              <div className={cn("h-1 w-full", phaseStripe[ph])} />
              <div className="py-1">
                <div className="text-[9px] uppercase text-muted-foreground">{format(d, "EE", { locale: de })}</div>
                {isToday ? (
                  <div className="flex justify-center">
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground font-bold text-xs">
                      {format(d, "d")}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm">{format(d, "d")}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail-Kacheln */}
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={onOpenTracker}
          className="rounded-xl bg-card border border-border/60 p-4 text-left hover:border-primary/40 transition-all"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Energielevel</div>
          {energy !== null ? (
            <>
              <div className="text-2xl mb-2">
                <span className="capitalize">
                  {["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"][Math.min(4, Math.max(0, Math.round(energy) - 1))]}
                </span>
                <span className="text-base text-muted-foreground ml-2 tabular-nums">{energy.toFixed(1)}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${((energy - 1) / 4) * 100}%` }} />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Noch nicht eingetragen — tippen zum Tracken</div>
          )}
        </button>

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

        <div className="rounded-xl bg-card border border-border/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Termine</div>
            {onAddEvent && (
              <button onClick={onAddEvent} className="text-xs text-primary hover:underline">+ Neu</button>
            )}
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Termine.</div>
          ) : (
            <ul className="space-y-1">
              {events.map(e => {
                const isShared = !!e._shared_owner_name;
                const editable = !isShared && !!onEditEvent;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={editable ? () => onEditEvent!(e) : undefined}
                      disabled={!editable}
                      className={cn(
                        "w-full text-left text-sm rounded-md px-2 py-1.5 -mx-2 transition-colors",
                        editable && "hover:bg-muted/60 cursor-pointer",
                        !editable && "cursor-default",
                      )}
                      aria-label={editable ? `${e.title} bearbeiten` : e.title}
                    >
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate">{e.title}</span>
                        {isShared && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-dashed border-border rounded px-1 py-px">
                            von {e._shared_owner_name}
                          </span>
                        )}
                        {editable && (
                          <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">bearbeiten</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.all_day ? "Ganztägig" : format(new Date(e.starts_at), "HH:mm")}
                        {e.location && ` · ${e.location}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-card border border-border/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">To-dos</div>
            {onAddTodo && (
              <button onClick={onAddTodo} className="text-xs text-primary hover:underline">+ Neu</button>
            )}
          </div>
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
