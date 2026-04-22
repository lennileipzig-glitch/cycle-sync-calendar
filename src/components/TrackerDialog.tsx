import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { fmtDate } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

const DEFAULT_SYMPTOMS = ["Krämpfe", "Kopfschmerz", "Müdigkeit", "Reizbarkeit", "Heißhunger", "Brustspannen", "Akne", "Wassereinlagerung", "Schlafprobleme"];
const MOODS = ["😊", "😌", "🙂", "😐", "😔", "😢", "😤", "🥰"];
const CUSTOM_SYMPTOMS_KEY = "luna-custom-symptoms";

// Energie-Skala 1–5
const ENERGY_LABELS = ["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"] as const;
const energyToNum = (raw: string | null | undefined): number => {
  if (!raw) return 3;
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  // Backward-Compat für alte Werte
  if (raw === "niedrig") return 2;
  if (raw === "hoch") return 4;
  return 3; // "mittel" oder unbekannt
};

const loadCustomSymptoms = (): string[] => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SYMPTOMS_KEY) || "[]"); } catch { return []; }
};
const saveCustomSymptoms = (list: string[]) => localStorage.setItem(CUSTOM_SYMPTOMS_KEY, JSON.stringify(list.slice(-30)));

export function TrackerDialog({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mood, setMood] = useState<string>("");
  const [energy, setEnergy] = useState<number>(3);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptoms, setCustomSymptoms] = useState<string[]>([]);
  const [newSymptom, setNewSymptom] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const today = fmtDate(new Date());

  useEffect(() => {
    if (!open) return;
    setCustomSymptoms(loadCustomSymptoms());
    (async () => {
      const todayLog = await dataApi.getLog(userId, today);
      if (todayLog) {
        setMood(todayLog.mood ?? "");
        setEnergy(energyToNum(todayLog.energy_level));
        setSymptoms(todayLog.symptoms ?? []);
        setNotes(todayLog.notes ?? "");
      } else {
        // Frischer Tag: keine Vorbelegung — Nutzerin entscheidet selbst
        setMood("");
        setEnergy(3);
        setSymptoms([]);
        setNotes("");
      }
    })();
  }, [open, userId, today]);

  const toggleSymptom = (s: string) =>
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const addCustomSymptom = () => {
    const v = newSymptom.trim();
    if (!v) return;
    if (!symptoms.includes(v)) setSymptoms(prev => [...prev, v]);
    if (!DEFAULT_SYMPTOMS.includes(v) && !customSymptoms.includes(v)) {
      const updated = [...customSymptoms, v];
      setCustomSymptoms(updated);
      saveCustomSymptoms(updated);
    }
    setNewSymptom("");
  };

  const removeCustomSymptom = (s: string) => {
    const updated = customSymptoms.filter(x => x !== s);
    setCustomSymptoms(updated);
    saveCustomSymptoms(updated);
    setSymptoms(prev => prev.filter(x => x !== s));
  };

  const save = async () => {
    setBusy(true);
    try {
      await dataApi.upsertLog(userId, {
        log_date: today,
        mood: mood || null,
        energy_level: String(energy),
        symptoms,
        notes: notes || null,
      });
      toast.success("Eingetragen 🌿");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Wie geht's dir heute?</DialogTitle>
          <DialogDescription>Ein paar kurze Angaben helfen Luna, deinen Tag besser auf dich abzustimmen.</DialogDescription>
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
            <div className="flex items-baseline justify-between mb-3">
              <Label>Energielevel</Label>
              <span className="text-sm font-medium capitalize">{ENERGY_LABELS[energy - 1]}</span>
            </div>
            <Slider
              value={[energy]}
              min={1}
              max={5}
              step={1}
              onValueChange={(v) => setEnergy(v[0])}
              className="my-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
              <span>sehr schlecht</span>
              <span>schlecht</span>
              <span>mittel</span>
              <span>gut</span>
              <span>sehr gut</span>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Beschwerden</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SYMPTOMS.map(s => (
                <button key={s} type="button" onClick={() => toggleSymptom(s)}
                  className={cn("px-3 py-1.5 rounded-full text-sm border transition-all",
                    symptoms.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40")}>
                  {s}
                </button>
              ))}
              {customSymptoms.map(s => (
                <span key={s} className={cn(
                  "inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full text-sm border transition-all",
                  symptoms.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40",
                )}>
                  <button type="button" onClick={() => toggleSymptom(s)}>{s}</button>
                  <button
                    type="button"
                    onClick={() => removeCustomSymptom(s)}
                    className={cn(
                      "h-5 w-5 inline-flex items-center justify-center rounded-full",
                      symptoms.includes(s) ? "hover:bg-primary-foreground/20" : "hover:bg-muted",
                    )}
                    aria-label={`${s} entfernen`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                value={newSymptom}
                onChange={e => setNewSymptom(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomSymptom(); } }}
                placeholder="Eigene Beschwerde hinzufügen..."
              />
              <Button type="button" size="icon" variant="secondary" onClick={addCustomSymptom} aria-label="Beschwerde hinzufügen">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {customSymptoms.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Eigene Beschwerden bleiben gespeichert und stehen beim nächsten Mal als Auswahl bereit.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="notes" className="mb-2 block">Notiz an mich…</Label>
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
