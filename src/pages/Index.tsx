import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getPhase } from "@/lib/cycle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sparkles } from "lucide-react";
import { MonthView, WeekView, YearView } from "@/components/CalendarViews";
import { TodoList } from "@/components/TodoList";
import { TrackerDialog } from "@/components/TrackerDialog";
import { Recommendations } from "@/components/Recommendations";
import { ProfileSettings } from "@/components/ProfileSettings";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/cycle";

type Zoom = "year" | "month" | "week";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, update } = useProfile(user?.id);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [todayLog, setTodayLog] = useState<{ energy_level?: string | null; symptoms?: string[] | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  // Auto-open tracker once per session if not yet logged today
  useEffect(() => {
    if (!user) return;
    const key = `tracker-shown-${fmtDate(new Date())}`;
    if (sessionStorage.getItem(key)) return;
    (async () => {
      const { data } = await supabase.from("daily_logs").select("id").eq("user_id", user.id).eq("log_date", fmtDate(new Date())).maybeSingle();
      if (!data) {
        setTrackerOpen(true);
        sessionStorage.setItem(key, "1");
      }
    })();
  }, [user]);

  // Load today's log for recommendations context
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("daily_logs").select("energy_level,symptoms")
        .eq("user_id", user.id).eq("log_date", fmtDate(new Date())).maybeSingle();
      setTodayLog(data);
    })();
  }, [user, trackerOpen]);

  const phase = useMemo(() => getPhase(
    selectedDate,
    profile?.last_period_start ? new Date(profile.last_period_start) : null,
    profile?.avg_cycle_length, profile?.avg_period_length
  ), [selectedDate, profile]);

  if (authLoading || !user || !profile) {
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
            <p className="text-xs text-muted-foreground">Hallo {profile.display_name ?? "schön"}, schön dass du da bist.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setTrackerOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Tracken
            </Button>
            <ProfileSettings profile={profile} onSave={update} />
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {/* Phase summary */}
        <Card className="p-6 shadow-soft" style={{ background: `linear-gradient(135deg, ${phase.color}22, hsl(var(--card)))` }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ background: phase.color }} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {phase.dayInCycle ? `Tag ${phase.dayInCycle} von ${phase.cycleLength}` : "Profil unvollständig"}
                </span>
              </div>
              <h2 className="text-3xl mb-1">{phase.label}</h2>
              <p className="text-sm text-muted-foreground max-w-xl">{phase.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Ausgewählt</div>
              <div className="text-lg font-medium capitalize">{format(selectedDate, "EEEE, d. MMMM", { locale: de })}</div>
            </div>
          </div>
        </Card>

        {/* Calendar controls */}
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
          {zoom === "week" && <WeekView monthDate={selectedDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} profile={profile} />}
        </Card>

        {/* Day view */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-soft">
            <h3 className="text-lg mb-3 capitalize">To-dos · {format(selectedDate, "EEEE", { locale: de })}</h3>
            <TodoList userId={user.id} date={selectedDate} />
          </Card>
          <Card className="p-5 shadow-soft">
            <h3 className="text-lg mb-3">Phasen-Cheat-Sheet</h3>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{phase.description}</p>
              {todayLog?.energy_level && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Heutiges Energielevel:</span>
                  <span className="font-medium capitalize">{todayLog.energy_level}</span>
                </div>
              )}
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

      <TrackerDialog userId={user.id} open={trackerOpen} onOpenChange={setTrackerOpen} />
    </div>
  );
};

export default Index;
