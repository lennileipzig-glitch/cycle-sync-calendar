import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getPhase, fmtDate } from "@/lib/cycle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Sparkles, User, Settings as SettingsIcon, Share2 } from "lucide-react";
import { ShareCalendarDialog } from "@/components/ShareCalendarDialog";
import { MonthView, WeekView, YearView, DayView } from "@/components/CalendarViews";
import { TrackerDialog } from "@/components/TrackerDialog";
import { EventDialog } from "@/components/EventDialog";
import { TodoDialog } from "@/components/TodoDialog";
import { PhaseLegend } from "@/components/PhaseLegend";
import { Recommendations } from "@/components/Recommendations";
import { VoiceFAB } from "@/components/VoiceFAB";

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
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<GuestEvent | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<Date>(new Date());
  const [quickAddTime, setQuickAddTime] = useState<string | null>(null);
  const [quickAddCategory, setQuickAddCategory] = useState<"termin" | "mahlzeit" | "sport">("termin");
  const [lockEventCategory, setLockEventCategory] = useState(false);
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

  // Tag innerhalb der aktuellen Phase + Phasenlänge
  const phaseProgress = useMemo(() => {
    const cycleLen = profile?.avg_cycle_length ?? 28;
    const periodLen = profile?.avg_period_length ?? 5;
    const ovulationDay = cycleLen - 14;
    const d = phase.dayInCycle;
    if (!d) return null;
    let phaseStart = 1, phaseLen = 1;
    if (phase.phase === "menstrual") { phaseStart = 1; phaseLen = periodLen; }
    else if (phase.phase === "follicular") { phaseStart = periodLen + 1; phaseLen = (ovulationDay - 1) - (periodLen + 1) + 1; }
    else if (phase.phase === "ovulation") { phaseStart = ovulationDay - 1; phaseLen = 3; }
    else if (phase.phase === "luteal") { phaseStart = ovulationDay + 2; phaseLen = cycleLen - phaseStart + 1; }
    else return null;
    return { dayInPhase: d - phaseStart + 1, phaseLen: Math.max(1, phaseLen) };
  }, [phase, profile]);

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
    const m: Record<string, { id: string; title: string; completed: boolean }[]> = {};
    weekTodos.forEach(t => { (m[t.todo_date] ??= []).push({ id: t.id, title: t.title, completed: t.completed }); });
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
            <h1 className="text-2xl">Fravia</h1>
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
        {/* Kalender-Steuerung */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <h3 className="text-xl px-2 capitalize min-w-[220px] text-center">{headerLabel}</h3>
            <Button variant="ghost" size="icon" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Teilen</span>
            </Button>
            <div className="flex items-center gap-1 bg-muted rounded-full p-1">
              {ZOOM_ORDER.map(z => (
                <Button key={z} variant={zoom === z ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setZoom(z)}>
                  {ZOOM_LABELS[z]}
                </Button>
              ))}
            </div>
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
                onAddEventForDate={(d) => { setQuickAddDate(d); setQuickAddCategory("termin"); setLockEventCategory(false); setEventDialogOpen(true); }}
                onAddTodoForDate={(d) => { setQuickAddDate(d); setTodoDialogOpen(true); }}
                onAddMealForDate={(d) => { setQuickAddDate(d); setQuickAddCategory("mahlzeit"); setLockEventCategory(false); setEventDialogOpen(true); }}
                onMoveEvent={async (ev, newDate) => {
                  await dataApi.moveEventToDate(userId, ev, newDate);
                  setAllEvents(await dataApi.getEvents(userId));
                }}
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
                todosByDay={todosByDay}
                onAddEventForDate={(d) => { setQuickAddDate(d); setQuickAddTime(null); setQuickAddCategory("termin"); setLockEventCategory(true); setEditEvent(null); setEventDialogOpen(true); }}
                onAddTodoForDate={(d) => { setQuickAddDate(d); setTodoDialogOpen(true); }}
                onAddMealForDate={(d) => { setQuickAddDate(d); setQuickAddCategory("mahlzeit"); setLockEventCategory(false); setEditEvent(null); setEventDialogOpen(true); }}
                onAddEventAtTime={(d, time) => { setQuickAddDate(d); setQuickAddTime(time); setQuickAddCategory("termin"); setLockEventCategory(true); setEditEvent(null); setEventDialogOpen(true); }}
                onMoveEvent={async (ev, newDate) => {
                  await dataApi.moveEventToDate(userId, ev, newDate);
                  setAllEvents(await dataApi.getEvents(userId));
                }}
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
                onAddEvent={() => { setQuickAddDate(selectedDate); setQuickAddCategory("termin"); setLockEventCategory(false); setEditEvent(null); setEventDialogOpen(true); }}
                onAddTodo={() => { setQuickAddDate(selectedDate); setTodoDialogOpen(true); }}
                onEditEvent={(ev) => { setEditEvent(ev); setQuickAddDate(new Date(ev.starts_at)); setEventDialogOpen(true); }}
                userId={userId}
                onEventChanged={async () => setAllEvents(await dataApi.getEvents(userId))}
              />
            </Card>
          )}
        </div>

        {(zoom === "week" || zoom === "month") && (
          <PhaseLegend className="px-1" />
        )}

        {zoom === "day" && (
          <>
            {/* Phasen-Info kompakt: nur Phase, Tag in Phase, kurzer Text */}
            <Card className="p-4 shadow-soft" style={{ background: `linear-gradient(135deg, ${phase.color}22, hsl(var(--card)))` }}>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ background: phase.color }} />
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-lg font-medium">{profile.in_menopause ? "Im Wandel" : phase.label}</h3>
                    {!profile.in_menopause && phaseProgress && (
                      <span className="text-xs text-muted-foreground">
                        Tag {phaseProgress.dayInPhase} von {phaseProgress.phaseLen} in dieser Phase
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {profile.in_menopause
                      ? "Höre auf deinen Körper. Fravia richtet die Empfehlungen auf Energie und Wohlbefinden aus."
                      : phase.description}
                  </p>
                </div>
              </div>
            </Card>

            <PhaseLegend className="px-1" />

            <Recommendations
              phase={phase}
              energy={dayLog?.energy_level ?? todayLog?.energy_level}
              symptoms={dayLog?.symptoms ?? todayLog?.symptoms ?? []}
              selectedDate={selectedDate}
              userId={userId}
              dayEvents={dayEvents}
              onEditEvent={(ev) => { setEditEvent(ev); setQuickAddDate(new Date(ev.starts_at)); setEventDialogOpen(true); }}
              onEventAdded={async () => setAllEvents(await dataApi.getEvents(userId))}
            />
          </>
        )}


        <footer className="text-center text-xs text-muted-foreground py-8">
          Fravia · für dich, im Einklang mit deinem Zyklus
        </footer>
      </main>

      <TrackerDialog userId={userId} open={trackerOpen} onOpenChange={setTrackerOpen} />

      <EventDialog
        userId={userId}
        date={quickAddDate}
        initialTime={quickAddTime}
        initialCategory={quickAddCategory}
        lockCategory={lockEventCategory}
        open={eventDialogOpen}
        onOpenChange={(v) => { setEventDialogOpen(v); if (!v) { setEditEvent(null); setQuickAddTime(null); setQuickAddCategory("termin"); setLockEventCategory(false); } }}
        event={editEvent}
        onCreated={async () => {
          setAllEvents(await dataApi.getEvents(userId));
          setEditEvent(null);
          setQuickAddTime(null);
          setQuickAddCategory("termin");
          setLockEventCategory(false);
        }}
      />

      <TodoDialog
        userId={userId}
        date={quickAddDate}
        open={todoDialogOpen}
        onOpenChange={setTodoDialogOpen}
        onCreated={async () => {
          // Wochen-Todos neu laden, damit Post-Its sofort erscheinen
          const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
          const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
          const todos: typeof weekTodos = [];
          for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
            const k = fmtDate(d);
            const dayTodos = await dataApi.getTodos(userId, k);
            dayTodos.forEach(t => todos.push({ ...t, todo_date: k }));
          }
          setWeekTodos(todos);
          if (fmtDate(quickAddDate) === fmtDate(selectedDate)) {
            setDayTodosState(await dataApi.getTodos(userId, fmtDate(selectedDate)));
          }
        }}
      />

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

      <ShareCalendarDialog ownerId={userId} open={shareOpen} onOpenChange={setShareOpen} />

      <VoiceFAB
        userId={userId}
        profile={profile}
        onChanged={async () => setAllEvents(await dataApi.getEvents(userId))}
      />
    </div>
  );
};

export default Index;
