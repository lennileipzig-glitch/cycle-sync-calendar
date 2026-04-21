import { addDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { phaseForDate } from "@/lib/cycle";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";

const phaseClass: Record<string, string> = {
  menstrual: "bg-phase-menstrual/30",
  follicular: "bg-phase-follicular/25",
  ovulation: "bg-phase-ovulation/25",
  luteal: "bg-phase-luteal/25",
  unknown: "bg-transparent",
};

interface Props {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  profile: Profile | null;
}

export function MonthView({ monthDate, selectedDate, onSelectDate, profile }: Props) {
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
          return (
            <button key={d.toISOString()} onClick={() => onSelectDate(d)}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all relative",
                phaseClass[phase],
                !inMonth && "opacity-30",
                selected && "ring-2 ring-primary shadow-soft scale-105",
                !selected && "hover:bg-accent",
                isToday && "font-bold",
              )}>
              <span>{format(d, "d")}</span>
              {isToday && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ selectedDate, onSelectDate, profile }: Omit<Props, "monthDate">) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2 animate-fade-in">
      {days.map(d => {
        const phase = phaseForDate(d, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length);
        const selected = isSameDay(d, selectedDate);
        const isToday = isSameDay(d, today);
        return (
          <button key={d.toISOString()} onClick={() => onSelectDate(d)}
            className={cn(
              "rounded-2xl p-3 flex flex-col items-center transition-all",
              phaseClass[phase],
              selected ? "ring-2 ring-primary shadow-elevated" : "hover:shadow-soft",
            )}>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{format(d, "EEE", { locale: de })}</span>
            <span className={cn("text-2xl mt-1", isToday && "font-bold text-primary")}>{format(d, "d")}</span>
          </button>
        );
      })}
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
                return <div key={d.toISOString()} className={cn("aspect-square rounded-sm", phaseClass[phase], !isSameMonth(d, m) && "opacity-20")} />;
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
