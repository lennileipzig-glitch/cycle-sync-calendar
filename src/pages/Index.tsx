import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getPhase, fmtDate } from "@/lib/cycle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Sparkles, Calendar as CalendarIcon, ListTodo, User, Settings as SettingsIcon, Plus } from "lucide-react";
import { MonthView, WeekView, YearView, DayView } from "@/components/CalendarViews";
import { TodoList } from "@/components/TodoList";
import { TrackerDialog } from "@/components/TrackerDialog";
import { EventDialog } from "@/components/EventDialog";
import { Recommendations } from "@/components/Recommendations";

import { OnboardingDialog } from "@/components/OnboardingDialog";
import { dataApi } from "@/lib/dataApi";
import { isGuest, type GuestEvent } from "@/lib/guestStore";

type Zoom = "year" | "month" | "week" | "day";
const ZOOM_ORDER: Zoom[] = ["year", "month", "week", "day"];
const ZOOM_LABELS: Record<Zoom, string> = { year: "Jahr", month: "Monat", week: "Woche", day: "Tag" };

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, guestMode } = useAuth();
  const guest = guestMode || isGuest();
  const { profile, update } = useProfile(user?.id, guest);
  const userId = user?.id ?? null;

  const [zoom, setZoom] = useState<Zoom>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [todayLog, setTodayLog] = useState<{ energy_level?: string | null; symptoms?: string[] | null; notes?: string | null } | null>(null);
  const [allEvents, setAllEvents] = useState<GuestEvent[]>([]);
  const [weekTodos, setWeekTodos] = useState<{ id: string; title: string; completed: boolean; todo_date: string }[]>([]);
  const [weekMood, setWeekMood] = useState<Record<string, { energy?: string | null; symptoms?: string[] }>>({});
  const [dayLog, setDayLog] = useState<{ energy_level?: string | null; symptoms?: string[] | null; notes?: string | null } | null>(null);
  const [dayTodosState, setDayTodosState] = useState<{ id: string; title: string; completed: boolean }[]>([]);

  useEffect(() => {
    if (!authLoading && !user && !guest) navigate("/auth", { replace: true });
  }, [authLoading, user, guest, navigate]);

  const showOnboarding = !!profile && !profile.onboarding_completed;

  // Auto-Tracker einmal pro Tag
  useEffect(() => {
    if (!profile || showOnboarding) return;
    const key = `tracker-shown-${fmtDate(new Date())}`;
    if (sessionStorage.getItem(key)) return;
    (async () => {
      const log = await dataApi.getLog(userId, fmtDate(new Date()));
      if (!log) {
        setTrackerOpen(true);
        sessionStorage.setItem(key, "1");
      }
    })();
  }, [profile, showOnboarding, userId]);

  // Heutiger Log für die Phasen-Karte oben
  useEffect(() => {
    if (!profile) return;
    (async () => setTodayLog(await dataApi.getLog(userId, fmtDate(new Date()))))();
  }, [profile, userId, trackerOpen]);

  // Alle Events laden (für Maps)
  useEffect(() => {
    if (!profile) return;
    (async () => setAllEvents(await dataApi.getEvents(userId)))();
  }, [profile, userId]);

  // Wochen-Todos & Mood-Daten für Wochen-Header
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
      const todos: typeof weekTodos = [];
      const moodMap: Record<string, { energy?: string | null; symptoms?: string[] }> = {};
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const key = fmtDate(d);
        const dayTodos = await dataApi.getTodos(userId, key);
        dayTodos.forEach(t => todos.push({ ...t, todo_date: key }));
        const log = await dataApi.getLog(userId, key);
        if (log) moodMap[key] = { energy: log.energy_level, symptoms: log.symptoms ?? [] };
      }
      setWeekTodos(todos);
      setWeekMood(moodMap);
    })();
  }, [profile, userId, selectedDate, trackerOpen]);

  // Tag-Detail (nur bei zoom=day relevant, aber günstig immer zu laden)
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const key = fmtDate(selectedDate);
      const [log, todos] = await Promise.all([
        dataApi.getLog(userId, key),
        dataApi.getTodos(userId, key),
      ]);
      setDayLog(log);
      setDayTodosState(todos);
    })();
  }, [profile, userId, selectedDate, trackerOpen]);

  const phase = useMemo(() => getPhase(
    selectedDate,
    profile?.last_period_start ? new Date(profile.last_period_start) : null,
    profile?.avg_cycle_length, profile?.avg_period_length,
  ), [selectedDate, profile]);

  // Maps
  const eventsByDay = useMemo(() => {
    const m: Record<string, GuestEvent[]> = {};
    allEvents.forEach(e => {
      const k = e.starts_at.slice(0, 10);
      (m[k] ??= []).push(e);
    });
    return m;
  }, [allEvents]);

  const todosByDay = useMemo(() => {
    const m: Record<string, { id: string; completed: boolean }[]> = {};
    weekTodos.forEach(t => { (m[t.todo_date] ??= []).push({ id: t.id, completed: t.completed }); });
    return m;
  }, [weekTodos]);

  const dayEvents = eventsByDay[fmtDate(selectedDate)] ?? [];

  // ---- Wheel/Pinch-Zoom ----
  const containerRef = useRef<HTMLDivElement>(null);
  const lastZoomTime = useRef(0);
  const handleWheel = useCallback((e: WheelEvent) => {
    // Pinch (Touchpad) = ctrlKey true; Scroll mit Cmd/Ctrl auch behandeln
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastZoomTime.current < 250) return;
    lastZoomTime.current = now;
    setZoom(prev => {
      const idx = ZOOM_ORDER.indexOf(prev);
      const next = e.deltaY < 0 ? Math.min(idx + 1, ZOOM_ORDER.length - 1) : Math.max(idx - 1, 0);
      return ZOOM_ORDER[next];
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  if (authLoading || (!user && !guest) || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade...</div>;
  }

  const navigatePrev = () => {
    if (zoom === "year") setSelectedDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1));
    else if (zoom === "month") setSelectedDate(d => subMonths(d, 1));
    else if (zoom === "week") setSelectedDate(d => subWeeks(d, 1));
    else setSelectedDate(d => subDays(d, 1));
  };
  const navigateNext = () => {
    if (zoom === "year") setSelectedDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1));
    else if (zoom === "month") setSelectedDate(d => addMonths(d, 1));
    else if (zoom === "week") setSelectedDate(d => addWeeks(d, 1));
    else setSelectedDate(d => addDays(d, 1));
  };

  const headerLabel =
    zoom === "year" ? format(selectedDate, "yyyy") :
    zoom === "month" ? format(selectedDate, "MMMM yyyy", { locale: de }) :
    zoom === "week" ? `KW ${format(selectedDate, "I", { locale: de })} · ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "d. MMM", { locale: de })}` :
    format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de });

  const handleDayClick = (d: Date) => {
    setSelectedDate(d);
    if (zoom === "year") setZoom("month");
    else if (zoom === "month") setZoom("week");
    else if (zoom === "week") setZoom("day");
  };

  const toggleDayTodo = async (id: string, completed: boolean) => {
    setDayTodosState(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await dataApi.toggleTodo(userId, id, completed);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-7xl flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl">Luna</h1>
            <p className="text-xs text-muted-foreground">
              Hallo {profile.display_name ?? "schön"}, schön dass du da bist.
              {guest && <span className="ml-1 italic">· Gast-Modus (lokal gespeichert)</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setTrackerOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Tracken
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} aria-label="Profil">
              <User className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} aria-label="Einstellungen">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl py-6 space-y-6">
        {/* Phasenkarte */}
        <Card className="p-6 shadow-soft" style={{ background: `linear-gradient(135deg, ${phase.color}22, hsl(var(--card)))` }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ background: phase.color }} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {profile.in_menopause ? "Menopause" : (phase.dayInCycle ? `Tag ${phase.dayInCycle} von ${phase.cycleLength}` : "Profil unvollständig")}
                </span>
              </div>
              <h2 className="text-3xl mb-1">{profile.in_menopause ? "Im Wandel" : phase.label}</h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                {profile.in_menopause
                  ? "Höre auf deinen Körper. Luna richtet die Empfehlungen auf Energie und Wohlbefinden aus."
                  : phase.description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Ausgewählt</div>
              <div className="text-lg font-medium capitalize">{format(selectedDate, "EEEE, d. MMMM", { locale: de })}</div>
            </div>
          </div>
        </Card>

        {/* Kalender-Steuerung */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <h3 className="text-xl px-2 capitalize min-w-[220px] text-center">{headerLabel}</h3>
            <Button variant="ghost" size="icon" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-full p-1">
            {ZOOM_ORDER.map(z => (
              <Button key={z} variant={zoom === z ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setZoom(z)}>
                {ZOOM_LABELS[z]}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-4 text-right">
          Tipp: ⌘/Strg + Scrollen oder Pinch-Zoom wechselt zwischen den Ansichten.
        </p>

        {/* Kalender-Ansicht */}
        <div ref={containerRef}>
          {zoom === "year" && (
            <Card className="p-4 shadow-soft">
              <YearView selectedDate={selectedDate} onSelectDate={handleDayClick} profile={profile} />
            </Card>
          )}
          {zoom === "month" && (
            <Card className="p-4 shadow-soft">
              <MonthView
                monthDate={selectedDate}
                selectedDate={selectedDate}
                onSelectDate={handleDayClick}
                profile={profile}
                eventsByDay={eventsByDay}
                todosByDay={todosByDay}
              />
            </Card>
          )}
          {zoom === "week" && (
            <Card className="p-4 shadow-soft">
              <WeekView
                selectedDate={selectedDate}
                onSelectDate={handleDayClick}
                profile={profile}
                eventsByDay={eventsByDay}
                moodByDay={weekMood}
              />
            </Card>
          )}
          {zoom === "day" && (
            <Card className="p-4 shadow-soft">
              <DayView
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                profile={profile}
                events={dayEvents}
                todos={dayTodosState}
                log={dayLog}
                onToggleTodo={toggleDayTodo}
                onOpenTracker={() => setTrackerOpen(true)}
              />
            </Card>
          )}
        </div>

        {/* Termine & To-dos getrennt — nur in Monat/Jahr/Woche relevant; Day-Ansicht hat sie schon eingebaut */}
        {zoom !== "day" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Termine · <span className="capitalize text-muted-foreground text-base">{format(selectedDate, "EEEE", { locale: de })}</span>
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setEventDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Termin
                </Button>
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Keine Termine an diesem Tag.</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map(e => (
                    <li key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                      <div className="w-1 self-stretch rounded-full" style={{ background: phase.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.all_day ? "Ganztägig" : format(new Date(e.starts_at), "HH:mm", { locale: de })}
                          {e.location && ` · ${e.location}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5 shadow-soft">
              <h3 className="text-lg mb-3 flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                To-dos · <span className="capitalize text-muted-foreground text-base">{format(selectedDate, "EEEE", { locale: de })}</span>
              </h3>
              <TodoList userId={userId} date={selectedDate} />
            </Card>
          </div>
        )}

        <Recommendations phase={phase} energy={dayLog?.energy_level ?? todayLog?.energy_level} symptoms={dayLog?.symptoms ?? todayLog?.symptoms ?? []} />

        <footer className="text-center text-xs text-muted-foreground py-8">
          Luna · für dich, im Einklang mit deinem Zyklus
        </footer>
      </main>

      <TrackerDialog userId={userId} open={trackerOpen} onOpenChange={setTrackerOpen} />

      <OnboardingDialog
        open={showOnboarding}
        initialName={profile.display_name}
        onComplete={async (data) => {
          await update({
            display_name: data.display_name,
            in_menopause: data.in_menopause,
            last_period_start: data.last_period_start,
            avg_cycle_length: data.avg_cycle_length,
            avg_period_length: data.avg_period_length,
            onboarding_completed: true,
          });
        }}
        onImportLogs={async (logs, earliestPeriodStart) => {
          await dataApi.bulkInsertLogs(userId, logs);
          if (earliestPeriodStart) {
            await update({ last_period_start: earliestPeriodStart });
          }
        }}
        onImportEvents={async (events) => {
          await dataApi.addEvents(userId, events.map(e => ({ ...e, source: "ics-import" })));
          setAllEvents(await dataApi.getEvents(userId));
        }}
      />
    </div>
  );
};

export default Index;
