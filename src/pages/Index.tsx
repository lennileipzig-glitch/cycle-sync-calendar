import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getPhase, fmtDate } from "@/lib/cycle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sparkles, MapPin } from "lucide-react";
import { MonthView, WeekView, YearView } from "@/components/CalendarViews";
import { TodoList } from "@/components/TodoList";
import { TrackerDialog } from "@/components/TrackerDialog";
import { Recommendations } from "@/components/Recommendations";
import { ProfileSettings } from "@/components/ProfileSettings";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { dataApi } from "@/lib/dataApi";
import { isGuest } from "@/lib/guestStore";
import type { GuestEvent } from "@/lib/guestStore";

type Zoom = "year" | "month" | "week";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, guestMode } = useAuth();
  const guest = guestMode || isGuest();
  const { profile, update } = useProfile(user?.id, guest);
  const userId = user?.id ?? null;

  const [zoom, setZoom] = useState<Zoom>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [todayLog, setTodayLog] = useState<{ energy_level?: string | null; symptoms?: string[] | null } | null>(null);
  const [dayEvents, setDayEvents] = useState<GuestEvent[]>([]);

  // Wenn weder eingeloggt noch Guest: zur Auth-Seite
  useEffect(() => {
    if (!authLoading && !user && !guest) navigate("/auth", { replace: true });
  }, [authLoading, user, guest, navigate]);

  const showOnboarding = !!profile && !profile.onboarding_completed;

  // Auto-Tracker einmal pro Tag (erst nach Onboarding)
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

  // Heutiger Log für Empfehlungen
  useEffect(() => {
    if (!profile) return;
    (async () => setTodayLog(await dataApi.getLog(userId, fmtDate(new Date()))))();
  }, [profile, userId, trackerOpen]);

  // Termine für ausgewählten Tag
  useEffect(() => {
    if (!profile) return;
    (async () => setDayEvents(await dataApi.getEventsForDate(userId, fmtDate(selectedDate))))();
  }, [profile, userId, selectedDate]);

  const phase = useMemo(() => getPhase(
    selectedDate,
    profile?.last_period_start ? new Date(profile.last_period_start) : null,
    profile?.avg_cycle_length, profile?.avg_period_length,
  ), [selectedDate, profile]);

  if (authLoading || (!user && !guest) || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade...</div>;
  }

  const navigatePrev = () => {
    if (zoom === "year") setSelectedDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1));
    else if (zoom === "month") setSelectedDate(d => subMonths(d, 1));
    else setSelectedDate(d => subWeeks(d, 1));
  };
  const navigateNext = () => {
    if (zoom === "year") setSelectedDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1));
    else if (zoom === "month") setSelectedDate(d => addMonths(d, 1));
    else setSelectedDate(d => addWeeks(d, 1));
  };

  const headerLabel = zoom === "year"
    ? format(selectedDate, "yyyy")
    : zoom === "month"
    ? format(selectedDate, "MMMM yyyy", { locale: de })
    : `${format(selectedDate, "d. MMM", { locale: de })} – Woche`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-6xl flex items-center justify-between py-4">
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
            <ProfileSettings profile={profile} userId={userId} onSave={update} />
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <h3 className="text-xl px-2 capitalize min-w-[180px] text-center">{headerLabel}</h3>
            <Button variant="ghost" size="icon" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-full p-1">
            <Button variant={zoom === "year" ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setZoom("year")}>
              <ZoomOut className="h-3 w-3 mr-1" /> Jahr
            </Button>
            <Button variant={zoom === "month" ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setZoom("month")}>
              Monat
            </Button>
            <Button variant={zoom === "week" ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setZoom("week")}>
              <ZoomIn className="h-3 w-3 mr-1" /> Woche
            </Button>
          </div>
        </div>

        <Card className="p-4 shadow-soft">
          {zoom === "year" && <YearView selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setZoom("month"); }} profile={profile} />}
          {zoom === "month" && <MonthView monthDate={selectedDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} profile={profile} />}
          {zoom === "week" && <WeekView selectedDate={selectedDate} onSelectDate={setSelectedDate} profile={profile} />}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-soft">
            <h3 className="text-lg mb-3 capitalize">Termine & To-dos · {format(selectedDate, "EEEE", { locale: de })}</h3>
            {dayEvents.length > 0 && (
              <div className="mb-4 space-y-2">
                {dayEvents.map(e => (
                  <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                    <div className="w-1 self-stretch rounded-full" style={{ background: phase.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.all_day ? "Ganztägig" : format(new Date(e.starts_at), "HH:mm", { locale: de })}
                        {e.location && <span className="inline-flex items-center gap-1 ml-2"><MapPin className="h-3 w-3" />{e.location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <TodoList userId={userId} date={selectedDate} />
          </Card>
          <Card className="p-5 shadow-soft">
            <h3 className="text-lg mb-3">Phasen-Cheat-Sheet</h3>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{phase.description}</p>
              {todayLog?.energy_level && (() => {
                const labels = ["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"];
                const n = parseInt(todayLog.energy_level, 10);
                const display = !isNaN(n) && n >= 1 && n <= 5
                  ? labels[n - 1]
                  : (todayLog.energy_level === "niedrig" ? "schlecht" : todayLog.energy_level === "hoch" ? "gut" : todayLog.energy_level);
                return (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Heutiges Energielevel:</span>
                    <span className="font-medium capitalize">{display}</span>
                  </div>
                );
              })()}
              {todayLog?.symptoms && todayLog.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {todayLog.symptoms.map(s => <span key={s} className="text-xs px-2 py-0.5 bg-muted rounded-full">{s}</span>)}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Recommendations phase={phase} energy={todayLog?.energy_level} symptoms={todayLog?.symptoms ?? []} />

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
        }}
      />
    </div>
  );
};

export default Index;
