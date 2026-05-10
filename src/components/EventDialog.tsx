import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate, findNextDateForEnergyCost } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { Trash2, CalendarCheck, UtensilsCrossed, Dumbbell } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { unpackMeta, packMeta, type EventMeta } from "@/lib/eventMeta";
import type { GuestEvent, EventCategory } from "@/lib/guestStore";

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
  /** Optional: Standard-Kategorie beim Anlegen */
  initialCategory?: EventCategory;
  /** Optional: Vorbefüllter Titel (z. B. aus KI-Rezept oder -Workout) */
  initialTitle?: string;
  /** Optional: Vorbefüllte Details (z. B. Rezept-Beschreibung) */
  initialDetails?: string;
  /** Optional: Kategorie-Wechsler ausblenden (z. B. wenn nur ein Termin angelegt werden soll) */
  lockCategory?: boolean;
}

type Recurrence = "none" | "daily" | "weekly" | "monthly";

const COST_LABEL = (c: number) => {
  if (c <= 1.5) return "sehr leicht";
  if (c <= 2.5) return "leicht";
  if (c <= 3.5) return "mittel";
  if (c <= 4.5) return "anstrengend";
  return "sehr anstrengend";
};

export function EventDialog({ userId, date, open, onOpenChange, onCreated, event, initialTime, initialCategory, initialTitle, initialDetails, lockCategory }: Props) {
  const { guestMode } = useAuth();
  const { profile } = useProfile(userId ?? undefined, guestMode);
  const isEdit = !!event;

  const [category, setCategory] = useState<EventCategory>("termin");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState(3);
  const [flexible, setFlexible] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta] = useState<EventMeta | null>(null);
  const [recipeServings, setRecipeServings] = useState<number>(2);
  const [tab, setTab] = useState<"edit" | "details">("edit");

  useEffect(() => {
    if (!open) return;
    if (event) {
      // Edit: Vorbefüllen
      const s = new Date(event.starts_at);
      const e = event.ends_at ? new Date(event.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const { text: plainDetails, meta: extractedMeta } = unpackMeta(event.details);
      setCategory(event.category ?? "termin");
      setTitle(event.title ?? "");
      setDetails(plainDetails);
      setMeta(extractedMeta);
      setTab("edit");
      if (extractedMeta?.kind === "recipe") {
        setRecipeServings(extractedMeta.servings && extractedMeta.servings > 0 ? extractedMeta.servings : 2);
      }
      setAllDay(!!event.all_day);
      setStartDate(fmtDate(s));
      setEndDate(fmtDate(e));
      setStartTime(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
      setEndTime(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
      setLocation(event.location ?? "");
      setCost(event.energy_cost ?? 3);
      setFlexible(!!event.is_flexible);
      setRecurrence((event.recurrence_freq as Recurrence) ?? "none");
      setUntil(event.recurrence_until ?? "");
    } else {
      const cat: EventCategory = initialCategory ?? "termin";
      setCategory(cat);
      setTitle(initialTitle ?? "");
      setDetails(initialDetails ?? "");
      setMeta(null);
      setTab("edit");
      setAllDay(false);
      setStartDate(fmtDate(date));
      setEndDate(fmtDate(date));
      // Sinnvolle Default-Zeiten je Kategorie
      const defaultStart =
        initialTime ?? (cat === "mahlzeit" ? "12:00" : cat === "sport" ? "18:00" : "09:00");
      setStartTime(defaultStart);
      const [h, m] = defaultStart.split(":").map(Number);
      const durH = cat === "mahlzeit" ? 1 : cat === "sport" ? 1 : 1;
      const endH = Math.min(23, h + durH);
      setEndTime(`${endH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      setLocation("");
      setCost(cat === "sport" ? 3.5 : cat === "mahlzeit" ? 1.5 : 3);
      setFlexible(false);
      setRecurrence("none");
      const u = new Date(date);
      u.setMonth(u.getMonth() + 3);
      setUntil(fmtDate(u));
    }
  }, [open, date, event, initialTime, initialCategory, initialTitle, initialDetails]);

  const lastPeriod = profile?.last_period_start ? new Date(profile.last_period_start) : null;
  const targetDate = flexible
    ? findNextDateForEnergyCost(date, cost, lastPeriod, profile?.avg_cycle_length, profile?.avg_period_length, 35, profile?.cycle_irregular ?? false)
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
    if (endDate < startDate) {
      toast.error("Das Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }
    setSaving(true);
    try {
      // Bei "Flexibler Tag" wird auf einen einzelnen passenden Tag geplant
      const startDateStr = flexible ? fmtDate(targetDate) : startDate;
      const endDateStr = flexible ? fmtDate(targetDate) : endDate;
      const toLocalIso = (dateStr: string, timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date(`${dateStr}T00:00:00`);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const starts_at = allDay
        ? new Date(`${startDateStr}T00:00:00`).toISOString()
        : toLocalIso(startDateStr, startTime);
      const ends_at = allDay
        ? new Date(`${endDateStr}T23:59:59`).toISOString()
        : toLocalIso(endDateStr, endTime);

      // Meta beibehalten (ggf. mit aktualisierter Portionenzahl bei Rezepten)
      const updatedMeta: EventMeta | null = meta
        ? meta.kind === "recipe"
          ? { ...meta, servings: recipeServings }
          : meta
        : null;
      const finalDetails = updatedMeta
        ? packMeta(details.trim(), updatedMeta)
        : (details.trim() || null);

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
        category,
        details: finalDetails,
      };

      const labelByCat: Record<EventCategory, string> = {
        termin: "Termin",
        mahlzeit: "Mahlzeit",
        sport: "Sport-Einheit",
      };

      if (isEdit && event) {
        await dataApi.updateEvent(userId, event.id, payload);
        toast.success(`${labelByCat[category]} aktualisiert`);
      } else {
        await dataApi.addEvents(userId, [payload]);
        toast.success(
          flexible
            ? `${labelByCat[category]} für ${format(targetDate, "EEEE, d. MMM", { locale: de })} eingeplant`
            : recurrence !== "none"
              ? `Wiederkehrende ${labelByCat[category]} angelegt`
              : `${labelByCat[category]} hinzugefügt`,
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
      toast.success("Gelöscht");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  const titleByCat: Record<EventCategory, string> = {
    termin: isEdit ? "Termin bearbeiten" : "Neuer Termin",
    mahlzeit: isEdit ? "Mahlzeit bearbeiten" : "Mahlzeit hinzufügen",
    sport: isEdit ? "Sport-Einheit bearbeiten" : "Sport-Einheit hinzufügen",
  };
  const placeholderByCat: Record<EventCategory, string> = {
    termin: "z. B. Yoga, Arzttermin",
    mahlzeit: "z. B. Quark mit Beeren",
    sport: "z. B. Boxkurs, Spaziergang",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleByCat[category]}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "edit" | "details")}>
          {meta && isEdit && (
            <TabsList className="grid grid-cols-2 w-full mb-2">
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="details">
                {meta.kind === "recipe" ? "Rezept" : "Übungen"}
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="edit" className="space-y-4 mt-0">
          {/* Kategorie-Auswahl (ausgeblendet, wenn Kategorie fixiert ist – z. B. Wochenansicht: nur Termin) */}
          {!lockCategory && !isEdit && (
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted">
              {([
                { v: "termin", icon: CalendarCheck, label: "Termin" },
                { v: "mahlzeit", icon: UtensilsCrossed, label: "Mahlzeit" },
                { v: "sport", icon: Dumbbell, label: "Sport" },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCategory(v)}
                  className={`flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors ${
                    category === v
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ev-title">Titel</Label>
            <Input id="ev-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={placeholderByCat[category]} autoFocus />
          </div>

          {category !== "termin" && (
            <div className="space-y-2">
              <Label htmlFor="ev-details">
                {category === "mahlzeit" ? "Notizen / Rezept" : "Beschreibung / Übungen"} <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="ev-details"
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder={category === "mahlzeit" ? "Zutaten, Zubereitung, …" : "z. B. 3×10 Liegestütze, Cardio-Block …"}
                rows={3}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="ev-allday">Ganztägig</Label>
            <Switch id="ev-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!flexible && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-startdate">Startdatum</Label>
                <Input
                  id="ev-startdate"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    if (endDate < v) setEndDate(v);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-enddate">Enddatum</Label>
                <Input
                  id="ev-enddate"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
          {!flexible && endDate > startDate && (
            <p className="text-xs text-muted-foreground -mt-1">
              Mehrtägiger Termin: erstreckt sich über {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1} Tage.
            </p>
          )}

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-start">
                  {category === "mahlzeit" ? "Beginn (optional)" : "Beginn"}
                </Label>
                <Input id="ev-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">
                  {category === "mahlzeit" ? "Ende (optional)" : "Ende"}
                </Label>
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
                Fravia ordnet den Termin automatisch einer passenden Zyklusphase zu.
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
