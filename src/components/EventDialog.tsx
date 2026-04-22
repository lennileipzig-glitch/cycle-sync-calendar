import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, findNextDateForEnergyCost } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { GuestEvent } from "@/lib/guestStore";

interface Props {
  userId: string | null;
  date: Date;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  /** Wenn gesetzt: Bearbeitungs-Modus statt Neu-Anlegen */
  event?: GuestEvent | null;
  /** Optional: Vorausgewählte Startzeit "HH:mm" (z. B. aus Wochenansicht) */
  initialTime?: string | null;
}

type Recurrence = "none" | "daily" | "weekly" | "monthly";

const COST_LABEL = (c: number) => {
  if (c <= 1.5) return "sehr leicht";
  if (c <= 2.5) return "leicht";
  if (c <= 3.5) return "mittel";
  if (c <= 4.5) return "anstrengend";
  return "sehr anstrengend";
};

export function EventDialog({ userId, date, open, onOpenChange, onCreated, event, initialTime }: Props) {
  const { guestMode } = useAuth();
  const { profile } = useProfile(userId ?? undefined, guestMode);
  const isEdit = !!event;

  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState(3);
  const [flexible, setFlexible] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      // Edit: Vorbefüllen
      const s = new Date(event.starts_at);
      const e = event.ends_at ? new Date(event.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setTitle(event.title ?? "");
      setAllDay(!!event.all_day);
      setStartTime(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
      setEndTime(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
      setLocation(event.location ?? "");
      setCost(event.energy_cost ?? 3);
      setFlexible(!!event.is_flexible);
      setRecurrence((event.recurrence_freq as Recurrence) ?? "none");
      setUntil(event.recurrence_until ?? "");
    } else {
      setTitle("");
      setAllDay(false);
      // Falls eine konkrete Uhrzeit übergeben wurde (z. B. Klick im Wochenraster)
      const start = initialTime ?? "09:00";
      setStartTime(start);
      // Endzeit = +1h
      const [h, m] = start.split(":").map(Number);
      const endH = Math.min(23, h + 1);
      setEndTime(`${endH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      setLocation("");
      setCost(3);
      setFlexible(false);
      setRecurrence("none");
      const u = new Date(date);
      u.setMonth(u.getMonth() + 3);
      setUntil(fmtDate(u));
    }
  }, [open, date, event, initialTime]);

  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const targetDate = flexible
    ? findNextDateForEnergyCost(date, cost, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length)
    : date;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein.");
      return;
    }
    if (recurrence !== "none" && !until) {
      toast.error("Bitte ein Enddatum für die Wiederholung wählen.");
      return;
    }
    setSaving(true);
    try {
      const dateStr = fmtDate(targetDate);
      const toLocalIso = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date(targetDate);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const starts_at = allDay
        ? new Date(`${dateStr}T00:00:00`).toISOString()
        : toLocalIso(startTime);
      const ends_at = allDay
        ? new Date(`${dateStr}T23:59:59`).toISOString()
        : toLocalIso(endTime);

      const payload = {
        title: title.trim(),
        starts_at,
        ends_at,
        all_day: allDay,
        location: location.trim() || null,
        source: "manual",
        energy_cost: Math.round(cost * 10) / 10,
        is_flexible: flexible,
        recurrence_freq: recurrence === "none" ? null : recurrence,
        recurrence_until: recurrence === "none" ? null : until,
      };

      if (isEdit && event) {
        await dataApi.updateEvent(userId, event.id, payload);
        toast.success("Termin aktualisiert");
      } else {
        await dataApi.addEvents(userId, [payload]);
        toast.success(
          flexible
            ? `Termin für ${format(targetDate, "EEEE, d. MMM", { locale: de })} eingeplant`
            : recurrence !== "none"
              ? "Wiederkehrenden Termin angelegt"
              : "Termin hinzugefügt",
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
    if (!event) return;
    if (!confirm("Diesen Termin wirklich löschen?")) return;
    setDeleting(true);
    try {
      await dataApi.deleteEvent(userId, event.id);
      toast.success("Termin gelöscht");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Titel</Label>
            <Input id="ev-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Yoga, Arzttermin" autoFocus />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ev-allday">Ganztägig</Label>
            <Switch id="ev-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-start">Beginn</Label>
                <Input id="ev-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">Ende</Label>
                <Input id="ev-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ev-loc">Ort (optional)</Label>
            <Input id="ev-loc" value={location} onChange={e => setLocation(e.target.value)} placeholder="z. B. zu Hause, Praxis Müller" />
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
              <Label htmlFor="ev-flex" className="cursor-pointer">Flexibler Tag</Label>
              <p className="text-xs text-muted-foreground">
                Luna ordnet den Termin automatisch einer passenden Zyklusphase zu.
              </p>
            </div>
            <Switch
              id="ev-flex"
              checked={flexible}
              onCheckedChange={(v) => {
                setFlexible(v);
                if (v) setRecurrence("none");
              }}
              disabled={recurrence !== "none"}
            />
          </div>

          {flexible && lastPeriod && (
            <p className="text-xs text-primary capitalize">
              → eingeplant für {format(targetDate, "EEEE, d. MMMM", { locale: de })}
            </p>
          )}

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <Label>Wiederholung</Label>
            <Select
              value={recurrence}
              onValueChange={(v: Recurrence) => {
                setRecurrence(v);
                if (v !== "none") setFlexible(false);
              }}
              disabled={flexible}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine</SelectItem>
                <SelectItem value="daily">Täglich</SelectItem>
                <SelectItem value="weekly">Wöchentlich</SelectItem>
                <SelectItem value="monthly">Monatlich</SelectItem>
              </SelectContent>
            </Select>
            {recurrence !== "none" && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="ev-until" className="text-xs">Wiederholen bis</Label>
                <Input id="ev-until" type="date" value={until} onChange={e => setUntil(e.target.value)} />
              </div>
            )}
            {flexible && (
              <p className="text-xs text-muted-foreground">
                Wiederholungen sind bei "Flexibler Tag" deaktiviert.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting || saving} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> {deleting ? "Lösche…" : "Löschen"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Speichere…" : isEdit ? "Speichern" : "Hinzufügen"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
