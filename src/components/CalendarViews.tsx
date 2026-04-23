import { addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { phaseForDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";
import type { GuestEvent, EventCategory } from "@/lib/guestStore";
import { fmtDate } from "@/lib/cycle";
import { CheckCircle2, Circle, Plus, CalendarPlus, ListPlus, UtensilsCrossed, Dumbbell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineAddMeal } from "@/components/InlineAddMeal";
import { InlineAddSport } from "@/components/InlineAddSport";
import { dataApi } from "@/lib/dataApi";
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
          const allEvents = eventsByDay[key] ?? [];
          const events = allEvents.filter(e => e.category !== "mahlzeit" && e.category !== "sport");
          const hasMeal = allEvents.some(e => e.category === "mahlzeit");
          const hasSport = allEvents.some(e => e.category === "sport");
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
              <div className="flex justify-between items-center px-1.5 pt-1 gap-1">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <QuickAddMenu date={d} onAddEventForDate={onAddEventForDate} onAddTodoForDate={onAddTodoForDate} onAddMealForDate={onAddMealForDate} size="xs" />
                </div>
                <div className="flex items-center gap-0.5 ml-auto">
                  {hasMeal && (
                    <UtensilsCrossed className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-label="Mahlzeit geplant" />
                  )}
                  {hasSport && (
                    <Dumbbell className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-label="Sport geplant" />
                  )}
                  {openTodos > 0 && (
                    <CheckCircle2 className="h-3 w-3 text-primary" aria-label={`${openTodos} offene Aufgaben`} />
                  )}
                  {isToday ? (
                    <span className="text-xs leading-none inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground font-bold ml-0.5">
                      {format(d, "d")}
                    </span>
                  ) : (
                    <span className="text-xs leading-none ml-0.5">{format(d, "d")}</span>
                  )}
                </div>
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

const HOURS = Array.from({ length: 24 }, (_, i) => i); // klickbare Slots: 0:00 – 23:00
const HOUR_LABELS = Array.from({ length: 25 }, (_, i) => i); // Labels: 0:00 – 24:00
const ROW_HEIGHT = 36; // px pro Stunde
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

export function WeekView({ selectedDate, onSelectDate, profile, eventsByDay = {}, moodByDay = {}, todosByDay = {}, onAddEventForDate, onAddTodoForDate, onAddEventAtTime, onAddMealForDate, onMoveEvent, onSelectEvent }: WeekProps) {
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

      {/* Stundenraster (scrollbar, ganzer Tag 0–24h) */}
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-0 relative max-h-[60vh] overflow-y-auto items-start">
          {/* Zeit-Spalte (inkl. 24:00 als Endmarker) */}
          <div className="flex flex-col sticky left-0 self-start bg-background z-10" style={{ height: HOURS.length * ROW_HEIGHT }}>
            {HOUR_LABELS.map(h => (
              <div
                key={h}
                style={{ height: h === 24 ? 0 : ROW_HEIGHT }}
                className="text-[10px] text-muted-foreground text-right pr-1 -mt-1.5"
              >
                {h.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map(d => {
            const key = fmtDate(d);
            const events = eventsByDay[key] ?? [];
            const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
            const isToday = isSameDay(d, today);

            const slotDropFor = (h: number) => onMoveEvent ? {
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
              onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                const data = e.dataTransfer.getData("application/x-luna-event");
                if (!data) return;
                try {
                  const ev = JSON.parse(data) as GuestEvent;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
                  const minutes = Math.min(45, Math.max(0, Math.round(((offsetY / ROW_HEIGHT) * 60) / 15) * 15));
                  const oldStart = new Date(ev.starts_at);
                  const oldEnd = ev.ends_at ? new Date(ev.ends_at) : null;
                  const durMs = oldEnd ? oldEnd.getTime() - oldStart.getTime() : 60 * 60 * 1000;
                  const newStart = new Date(d);
                  newStart.setHours(h, minutes, 0, 0);
                  const newEnd = new Date(newStart.getTime() + durMs);
                  const moved: GuestEvent = {
                    ...ev,
                    starts_at: newStart.toISOString(),
                    ends_at: newEnd.toISOString(),
                  };
                  onMoveEvent(moved, fmtDate(d));
                } catch { /* ignore */ }
              },
            } : {};

            return (
              <div
                key={d.toISOString()}
                style={{ height: HOURS.length * ROW_HEIGHT }}
                className={cn(
                  "relative self-start overflow-hidden bg-card/50 border-l-2 border-border/60",
                  isToday && "bg-primary/5 border-primary/50",
                )}
              >
                {HOURS.map((h, index) => (
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
                    className={cn(
                      "block w-full border-t border-border/40 hover:bg-primary/10 transition-colors group/slot relative text-left",
                      index === HOURS.length - 1 && "border-b-2 border-b-border/60",
                      index === 0 && "border-t-0",
                    )}
                    aria-label={`Termin am ${format(d, "EEEE", { locale: de })} um ${h}:00 hinzufügen`}
                    {...slotDropFor(h)}
                  >
                    <span className="absolute top-0.5 right-1 text-[9px] text-primary opacity-0 group-hover/slot:opacity-100 transition-opacity">
                      +
                    </span>
                  </button>
                ))}
                {events.filter(ev => ev.category !== "mahlzeit").map(ev => {
                  const startD = new Date(ev.starts_at);
                  const endD = ev.ends_at ? new Date(ev.ends_at) : new Date(startD.getTime() + 60 * 60 * 1000);
                  const Icon = categoryIcon(ev.category);
                  const draggable = !ev._shared_owner_name && !!onMoveEvent;
                  if (ev.all_day) {
                    return (
                      <div
                        key={ev.id}
                        draggable={draggable}
                        onDragStart={draggable ? (e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("application/x-luna-event", JSON.stringify(ev));
                        } : undefined}
                        onClick={(e) => { e.stopPropagation(); onSelectEvent?.(ev); }}
                        className={cn(
                          "absolute inset-x-0.5 top-0.5 px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer border-l-2",
                          phaseFill[phase],
                          categoryAccent(ev.category),
                          draggable && "cursor-grab active:cursor-grabbing",
                        )}
                        style={{ borderLeftColor: `hsl(var(--phase-${phase}))` }}
                      >
                        {Icon && <Icon className="inline h-2.5 w-2.5 mr-0.5 opacity-70" />}
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
                      draggable={draggable}
                      onDragStart={draggable ? (e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("application/x-luna-event", JSON.stringify(ev));
                      } : undefined}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent?.(ev); }}
                      className={cn(
                        "absolute inset-x-0.5 px-1.5 py-1 rounded text-[10px] overflow-hidden border-l-2 cursor-pointer hover:ring-1 hover:ring-primary/50",
                        phaseFill[phase],
                        categoryAccent(ev.category),
                        draggable && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{ top, height, borderLeftColor: `hsl(var(--phase-${phase}))` }}
                    >
                      <div className="font-medium truncate flex items-center gap-1">
                        {Icon && <Icon className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                        <span className="truncate">{ev.title}</span>
                      </div>
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

      {/* Mahlzeiten-Zeile (unter den To-dos) */}
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1 pt-1">
        <div className="text-[10px] text-muted-foreground self-start text-right pr-1 pt-1 leading-tight">
          Mahlzeiten
        </div>
        {days.map(d => {
          const key = fmtDate(d);
          const meals = (eventsByDay[key] ?? []).filter(e => e.category === "mahlzeit");
          const draggableProps = (ev: GuestEvent) => {
            const ok = !ev._shared_owner_name && !!onMoveEvent;
            return ok ? {
              draggable: true,
              onDragStart: (e: React.DragEvent) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/x-luna-event", JSON.stringify(ev));
              },
            } : {};
          };
          return (
            <div key={d.toISOString()} className="min-h-[3rem]" {...dropProps(d)}>
              {meals.length === 0 ? (
                <button
                  onClick={() => onAddMealForDate?.(d)}
                  className="w-full h-full min-h-[3rem] rounded-md border border-dashed border-amber-300/60 dark:border-amber-400/30 text-[10px] text-muted-foreground/70 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex items-center justify-center gap-1"
                  aria-label="Mahlzeit hinzufügen"
                >
                  <UtensilsCrossed className="h-3 w-3" /> <Plus className="h-3 w-3" />
                </button>
              ) : (
                <div className="rounded-md p-1.5 border border-amber-300/60 bg-amber-100/40 dark:bg-amber-400/10 dark:border-amber-400/30 space-y-0.5">
                  {meals.slice(0, 3).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelectEvent?.(m); }}
                      className="w-full text-left text-[10px] leading-tight truncate flex items-center gap-1 hover:underline"
                      {...draggableProps(m)}
                    >
                      <UtensilsCrossed className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      <span className="truncate">{m.title}</span>
                    </button>
                  ))}
                  {meals.length > 3 && (
                    <div className="text-[9px] text-muted-foreground">+{meals.length - 3} weitere</div>
                  )}
                  {onAddMealForDate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddMealForDate(d); }}
                      className="text-[9px] text-amber-700 dark:text-amber-300 hover:underline"
                    >
                      + weitere
                    </button>
                  )}
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
  /** Optional: User-ID für Inline-Anlegen von Mahlzeit/Sport */
  userId?: string | null;
  /** Wird aufgerufen, wenn eine Mahlzeit/Sport-Einheit hinzugefügt oder gelöscht wurde */
  onEventChanged?: () => void;
}

const energyToNum = (raw?: string | null) => energyToFloat(raw);

const intensityWord = (v: number) => {
  if (v <= 1.5) return "sehr leicht";
  if (v <= 2.5) return "leicht";
  if (v <= 3.5) return "mittel";
  if (v <= 4.5) return "intensiv";
  return "sehr intensiv";
};

export function DayView({ selectedDate, onSelectDate, profile, events, todos, log, onToggleTodo, onOpenTracker, onAddEvent, onAddTodo, onEditEvent, userId, onEventChanged }: DayProps) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();
  const energy = energyToNum(log?.energy_level);
  const phase = phaseForDate(selectedDate, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);

  const meals = events.filter(e => e.category === "mahlzeit");
  const sports = events.filter(e => e.category === "sport");
  const termine = events.filter(e => e.category !== "mahlzeit" && e.category !== "sport");

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    try {
      await dataApi.deleteEvent(userId ?? null, id);
      onEventChanged?.();
    } catch (e) {
      console.error(e);
    }
  };

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
          {termine.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Termine.</div>
          ) : (
            <ul className="space-y-1">
              {termine.map(e => {
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

        {/* Mahlzeiten & Bewegung wurden in die großen Empfehlungs-Kacheln unten verlagert */}
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
