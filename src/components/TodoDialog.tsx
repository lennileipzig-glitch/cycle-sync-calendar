import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { fmtDate, findNextDateForEnergyCost } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  userId: string | null;
  date: Date;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  /** Wenn gesetzt: Bearbeitungsmodus für vorhandene Aufgabe */
  todo?: { id: string; title: string; energy_cost?: number | null; is_flexible?: boolean } | null;
}

const COST_LABEL = (c: number) => {
  if (c <= 1.5) return "sehr leicht";
  if (c <= 2.5) return "leicht";
  if (c <= 3.5) return "mittel";
  if (c <= 4.5) return "anstrengend";
  return "sehr anstrengend";
};

export function TodoDialog({ userId, date, open, onOpenChange, onCreated, todo }: Props) {
  const { guestMode } = useAuth();
  const { profile } = useProfile(userId ?? undefined, guestMode);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(3);
  const [flexible, setFlexible] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = !!todo;

  useEffect(() => {
    if (open) {
      setTitle(todo?.title ?? "");
      setCost(todo?.energy_cost ?? 3);
      setFlexible(todo?.is_flexible ?? false);
    }
  }, [open, todo]);

  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const targetDate = flexible
    ? findNextDateForEnergyCost(date, cost, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length)
    : date;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && todo) {
        await dataApi.updateTodo(userId, todo.id, {
          title: title.trim(),
          energy_cost: Math.round(cost * 10) / 10,
          is_flexible: flexible,
        });
        toast.success("Aufgabe aktualisiert");
      } else {
        await dataApi.addTodo(userId, fmtDate(targetDate), title.trim(), {
          energy_cost: Math.round(cost * 10) / 10,
          is_flexible: flexible,
        });
        toast.success(
          flexible
            ? `Aufgabe für ${format(targetDate, "EEEE, d. MMM", { locale: de })} eingeplant`
            : "Aufgabe hinzugefügt",
        );
      }
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!todo) return;
    if (!confirm("Aufgabe wirklich löschen?")) return;
    setSaving(true);
    try {
      await dataApi.deleteTodo(userId, todo.id);
      toast.success("Aufgabe gelöscht");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Löschen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground capitalize">
            für {format(date, "EEEE, d. MMMM", { locale: de })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="todo-title">Aufgabe</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
              placeholder="z. B. Wasser trinken, Spaziergang"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Energieaufwand</Label>
              <span className="text-xs text-muted-foreground">
                {COST_LABEL(cost)} · {cost.toFixed(1)}
              </span>
            </div>
            <Slider value={[cost]} min={1} max={5} step={0.1} onValueChange={v => setCost(v[0])} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
            <div className="space-y-1">
              <Label htmlFor="todo-flex" className="cursor-pointer">Flexibler Tag</Label>
              <p className="text-xs text-muted-foreground">
                Fravia ordnet die Aufgabe automatisch einer passenden Zyklusphase zu.
              </p>
            </div>
            <Switch id="todo-flex" checked={flexible} onCheckedChange={setFlexible} />
          </div>

          {flexible && lastPeriod && (
            <p className="text-xs text-primary capitalize">
              → eingeplant für {format(targetDate, "EEEE, d. MMMM", { locale: de })}
            </p>
          )}
          {flexible && !lastPeriod && (
            <p className="text-xs text-muted-foreground">
              Trage erst deinen Zyklus ein, damit Fravia passend planen kann. Wird sonst auf das gewählte Datum gelegt.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichere…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
