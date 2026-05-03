import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Dumbbell, Plus, X } from "lucide-react";
import { dataApi } from "@/lib/dataApi";
import { toast } from "sonner";

interface Props {
  userId: string | null;
  date: Date;
  onCreated?: () => void;
}

const intensityLabel = (v: number) => {
  if (v <= 1.5) return "sehr leicht";
  if (v <= 2.5) return "leicht";
  if (v <= 3.5) return "mittel";
  if (v <= 4.5) return "intensiv";
  return "sehr intensiv";
};

export function InlineAddSport({ userId, date, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [time, setTime] = useState("18:00");
  const [intensity, setIntensity] = useState(3);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(""); setDetails(""); setTime("18:00"); setIntensity(3); setOpen(false); };

  const handleAdd = async () => {
    if (!title.trim()) { toast.error("Bitte Titel eingeben."); return; }
    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const start = new Date(date); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await dataApi.addEvents(userId, [{
        title: title.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: false,
        location: null,
        source: "manual",
        energy_cost: Math.round(intensity * 10) / 10,
        is_flexible: false,
        recurrence_freq: null,
        recurrence_until: null,
        category: "sport",
        details: details.trim() || null,
      }]);
      toast.success("Sport-Einheit hinzugefügt");
      reset();
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs hover:underline flex items-center gap-1 justify-center py-2 rounded-md border border-dashed transition-colors"
        style={{
          color: "hsl(var(--tile-movement))",
          borderColor: "hsl(var(--tile-movement) / 0.5)",
        }}
      >
        <Dumbbell className="h-3.5 w-3.5" /> <Plus className="h-3.5 w-3.5" /> Sport hinzufügen
      </button>
    );
  }

  return (
    <div
      className="space-y-2.5 rounded-md border p-2.5"
      style={{
        background: "hsl(var(--tile-movement) / 0.10)",
        borderColor: "hsl(var(--tile-movement) / 0.45)",
      }}
    >
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--tile-movement))" }} />
        <Input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z. B. Boxkurs, Spaziergang"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
        />
        <Input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="h-8 text-sm w-24"
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={reset} aria-label="Abbrechen">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs">Intensität</Label>
          <span className="text-xs text-muted-foreground">
            {intensityLabel(intensity)} · {intensity.toFixed(1)}
          </span>
        </div>
        <Slider value={[intensity]} min={1} max={5} step={0.1} onValueChange={v => setIntensity(v[0])} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>leicht</span>
          <span>intensiv</span>
        </div>
      </div>

      <Textarea
        value={details}
        onChange={e => setDetails(e.target.value)}
        placeholder="Übungen / Beschreibung (optional)"
        rows={2}
        className="text-xs"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving}
          style={{
            background: "hsl(var(--tile-movement))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          {saving ? "Speichere…" : "Hinzufügen"}
        </Button>
      </div>
    </div>
  );
}
