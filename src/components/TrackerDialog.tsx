import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/cycle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SYMPTOMS = ["Krämpfe", "Kopfschmerz", "Müdigkeit", "Reizbarkeit", "Heißhunger", "Brustspannen", "Akne", "Wassereinlagerung", "Schlafprobleme"];
const ENERGY = [{ k: "niedrig", emoji: "🌙" }, { k: "mittel", emoji: "🌤" }, { k: "hoch", emoji: "☀️" }] as const;
const MOODS = ["😊", "😌", "🙂", "😐", "😔", "😢", "😤", "🥰"];

export function TrackerDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mood, setMood] = useState<string>("");
  const [energy, setEnergy] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const today = fmtDate(new Date());

  useEffect(() => {
    if (!open) return;
    (async () => {
      // Prefill from today's log, fallback to last log (e.g. ~28 days ago — same cycle phase)
      const { data: todayLog } = await supabase.from("daily_logs").select("*").eq("user_id", userId).eq("log_date", today).maybeSingle();
      if (todayLog) {
        setMood(todayLog.mood ?? "");
        setEnergy(todayLog.energy_level ?? "");
        setSymptoms(todayLog.symptoms ?? []);
        setNotes(todayLog.notes ?? "");
        return;
      }
      const { data: prev } = await supabase
        .from("daily_logs").select("*").eq("user_id", userId)
        .order("log_date", { ascending: false }).limit(1).maybeSingle();
      if (prev) {
        setMood(prev.mood ?? "");
        setEnergy(prev.energy_level ?? "");
        setSymptoms(prev.symptoms ?? []);
        setNotes("");
      }
    })();
  }, [open, userId, today]);

  const toggleSymptom = (s: string) => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("daily_logs").upsert({
      user_id: userId, log_date: today, mood: mood || null, energy_level: energy || null, symptoms, notes: notes || null,
    }, { onConflict: "user_id,log_date" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Eingetragen 🌿");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Wie geht's dir heute?</DialogTitle>
          <DialogDescription>Dein Tracker lernt mit dir — beim nächsten Zyklus sind deine Antworten schon vorausgewählt.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div>
            <Label className="mb-3 block">Stimmung</Label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button key={m} type="button" onClick={() => setMood(m)}
                  className={cn("text-2xl w-12 h-12 rounded-full transition-all", mood === m ? "bg-primary/15 ring-2 ring-primary scale-110" : "bg-muted hover:bg-accent")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Energielevel</Label>
            <div className="grid grid-cols-3 gap-2">
              {ENERGY.map(e => (
                <button key={e.k} type="button" onClick={() => setEnergy(e.k)}
                  className={cn("py-3 rounded-xl border-2 transition-all capitalize text-sm font-medium",
                    energy === e.k ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}>
                  <div className="text-xl mb-1">{e.emoji}</div>{e.k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Beschwerden</Label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map(s => (
                <button key={s} type="button" onClick={() => toggleSymptom(s)}
                  className={cn("px-3 py-1.5 rounded-full text-sm border transition-all",
                    symptoms.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40")}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="mb-2 block">Notiz (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Was bewegt dich heute?" rows={2} />
          </div>

          <Button onClick={save} disabled={busy} className="w-full" size="lg">
            {busy ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
