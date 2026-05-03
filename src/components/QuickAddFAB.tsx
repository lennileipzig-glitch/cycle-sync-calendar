import { useState } from "react";
import { Plus, X, Calendar, ListTodo, Utensils, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onAddEvent: () => void;
  onAddTodo: () => void;
  onAddMeal: () => void;
  onAddSport: () => void;
}

export function QuickAddFAB({ onAddEvent, onAddTodo, onAddMeal, onAddSport }: Props) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "Termin", icon: Calendar, action: onAddEvent },
    { label: "Aufgabe", icon: ListTodo, action: onAddTodo },
    { label: "Mahlzeit", icon: Utensils, action: onAddMeal },
    { label: "Workout", icon: Dumbbell, action: onAddSport },
  ];

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { setOpen(false); it.action(); }}
              className="flex items-center gap-2 rounded-full bg-card border border-border shadow-md px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <span>{it.label}</span>
              <span className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                <it.icon className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95",
          "bg-primary text-primary-foreground"
        )}
        aria-label="Schnell hinzufügen"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  );
}
