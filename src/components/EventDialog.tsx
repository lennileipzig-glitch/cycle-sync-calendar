import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fmtDate } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { toast } from "sonner";

interface Props {
  userId: string | null;
  date: Date;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function EventDialog({ userId, date, open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setAllDay(false);
      setStartTime("09:00");
      setEndTime("10:00");
      setLocation("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein.");
      return;
    }
    setSaving(true);
    try {
      const dateStr = fmtDate(date);
      // Lokale Zeit -> ISO mit Zeitzonen-Offset, damit der Tag stabil bleibt
      const toLocalIso = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const starts_at = allDay
        ? new Date(`${dateStr}T00:00:00`).toISOString()
        : toLocalIso(startTime);
      const ends_at = allDay
        ? new Date(`${dateStr}T23:59:59`).toISOString()
        : toLocalIso(endTime);
      await dataApi.addEvents(userId, [{
        title: title.trim(),
        starts_at,
        ends_at,
        all_day: allDay,
        location: location.trim() || null,
        source: "manual",
      }]);
      toast.success("Termin hinzugefügt");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Termin</DialogTitle>
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichere…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
