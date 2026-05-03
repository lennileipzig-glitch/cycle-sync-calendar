import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Plus, X } from "lucide-react";
import { dataApi } from "@/lib/dataApi";
import { fmtDate } from "@/lib/cycle";
import { toast } from "sonner";

interface Props {
  userId: string | null;
  date: Date;
  onCreated?: () => void;
}

export function InlineAddMeal({ userId, date, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [time, setTime] = useState("12:00");
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(""); setDetails(""); setTime("12:00"); setOpen(false); };

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
        energy_cost: 1.5,
        is_flexible: false,
        recurrence_freq: null,
        recurrence_until: null,
        category: "mahlzeit",
        details: details.trim() || null,
      }]);
      toast.success("Mahlzeit hinzugefügt");
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
          color: "hsl(var(--tile-nutrition))",
          borderColor: "hsl(var(--tile-nutrition) / 0.5)",
        }}
      >
        <UtensilsCrossed className="h-3.5 w-3.5" /> <Plus className="h-3.5 w-3.5" /> Mahlzeit hinzufügen
      </button>
    );
  }

  return (
    <div
      className="space-y-2 rounded-md border p-2.5"
      style={{
        background: "hsl(var(--tile-nutrition) / 0.10)",
        borderColor: "hsl(var(--tile-nutrition) / 0.45)",
      }}
    >
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--tile-nutrition))" }} />
        <Input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z. B. Quark mit Beeren"
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
      <Textarea
        value={details}
        onChange={e => setDetails(e.target.value)}
        placeholder="Notizen / Rezept (optional)"
        rows={2}
        className="text-xs"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving}
          style={{
            background: "hsl(var(--tile-nutrition))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          {saving ? "Speichere…" : "Hinzufügen"}
        </Button>
      </div>
    </div>
  );
}
