import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ImportDialog } from "./ImportDialog";
import { Sparkles, Upload, Calendar as CalendarIcon, Info } from "lucide-react";
import { toast } from "sonner";
import type { EndometriosisStatus } from "@/hooks/useProfile";

export interface OnboardingData {
  display_name: string;
  in_menopause: boolean;
  cycle_irregular: boolean;
  last_period_start: string | null;
  avg_cycle_length: number;
  avg_period_length: number;
  endometriosis_status: EndometriosisStatus;
}

interface Props {
  open: boolean;
  initialName?: string | null;
  onComplete: (data: OnboardingData) => Promise<void> | void;
  onImportLogs?: (logs: { log_date: string; mood: string | null; energy_level: string | null; symptoms: string[]; notes: string | null }[], earliestPeriodStart: string | null) => Promise<void> | void;
  onImportEvents?: (events: { title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null }[]) => Promise<void> | void;
}

export function OnboardingDialog({ open, initialName, onComplete, onImportLogs, onImportEvents }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName ?? "");
  const [phase, setPhase] = useState<"cycling" | "menopause" | "">("");
  const [regularity, setRegularity] = useState<"regular" | "irregular" | "">("");
  const [lastPeriod, setLastPeriod] = useState("");
  const [knowsCycle, setKnowsCycle] = useState<"yes" | "no" | "">("");
  const [cycleLen, setCycleLen] = useState(28);
  const [knowsPeriod, setKnowsPeriod] = useState<"yes" | "no" | "">("");
  const [periodLen, setPeriodLen] = useState(5);
  const [endoStatus, setEndoStatus] = useState<EndometriosisStatus>("none");
  const [importOpen, setImportOpen] = useState<"csv" | "ics" | null>(null);

  const totalSteps = 5;
  const next = () => setStep(s => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const finish = async () => {
    await onComplete({
      display_name: name || "Du",
      in_menopause: phase === "menopause",
      cycle_irregular: phase === "cycling" && regularity === "irregular",
      last_period_start: phase === "menopause" ? null : (lastPeriod || null),
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      endometriosis_status: endoStatus,
    });
    toast.success("Willkommen bei Fravia 🌸");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => { /* nicht schließbar */ }}>
        <DialogContent className="max-w-lg" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl">Lass mich dich kennenlernen</DialogTitle>
            <DialogDescription>Schritt {step + 1} von {totalSteps} – du kannst alles später anpassen.</DialogDescription>
          </DialogHeader>
          <Progress value={((step + 1) / totalSteps) * 100} className="h-1" />

          <div className="py-4 space-y-5 min-h-[280px]">
            {step === 0 && (
              <div className="space-y-3">
                <Label htmlFor="name">Wie heißt du?</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Vorname" autoFocus />
                <p className="text-sm text-muted-foreground">Damit Fravia dich persönlich begrüßen kann.</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Label>In welcher Lebensphase bist du gerade?</Label>
                <RadioGroup value={phase} onValueChange={(v) => setPhase(v as "cycling" | "menopause")}>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                    <RadioGroupItem value="cycling" id="r-cycling" className="mt-0.5" />
                    <div>
                      <div className="font-medium">Ich habe einen Zyklus</div>
                      <div className="text-sm text-muted-foreground">Periode kommt regelmäßig oder unregelmäßig.</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                    <RadioGroupItem value="menopause" id="r-meno" className="mt-0.5" />
                    <div>
                      <div className="font-medium">Ich bin in der Menopause</div>
                      <div className="text-sm text-muted-foreground">Fravia fokussiert dann auf Energie & Wohlbefinden.</div>
                    </div>
                  </label>
                </RadioGroup>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-foreground">Endometriose</strong> ist eine chronische Erkrankung, bei der gebärmutterschleimhautähnliches Gewebe außerhalb der Gebärmutter wächst. Häufige Anzeichen: starke Regelschmerzen, Schmerzen im Becken, Erschöpfung. Fravia berücksichtigt das in ihren Empfehlungen.
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="pr-3">
                      <div className="text-sm font-medium">Ich habe diagnostizierte Endometriose</div>
                      <div className="text-xs text-muted-foreground">Ärztlich bestätigt (z. B. per Laparoskopie).</div>
                    </div>
                    <Switch
                      checked={endoStatus === "diagnosed"}
                      onCheckedChange={(v) => setEndoStatus(v ? "diagnosed" : "none")}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="pr-3">
                      <div className="text-sm font-medium">Bei mir ist Verdacht auf Endometriose</div>
                      <div className="text-xs text-muted-foreground">Symptome passen, aber noch keine gesicherte Diagnose.</div>
                    </div>
                    <Switch
                      checked={endoStatus === "suspected"}
                      onCheckedChange={(v) => setEndoStatus(v ? "suspected" : "none")}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && phase !== "menopause" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Wie ist dein Zyklus?</Label>
                  <RadioGroup value={regularity} onValueChange={(v) => setRegularity(v as "regular" | "irregular")}>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="regular" id="reg-y" className="mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Regelmäßige Periode</div>
                        <div className="text-xs text-muted-foreground">Meine Periode kommt in vorhersehbaren Abständen.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="irregular" id="reg-n" className="mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Unregelmäßige Periode</div>
                        <div className="text-xs text-muted-foreground">Mein Zyklus ist unregelmäßig. Fravia wartet dann auf deine Markierung „Heute hat meine Blutung begonnen", bevor sie auf Menstruation umstellt.</div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label htmlFor="lp">Wann hat deine letzte Periode begonnen?</Label>
                  <Input id="lp" type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                  <p className="text-sm text-muted-foreground">Wenn du es nicht weißt, lass das Feld leer – Fravia lernt mit jedem Tag, den du trackst.</p>
                </div>
              </div>
            )}
            {step === 2 && phase === "menopause" && (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Da du in der Menopause bist, brauchen wir keinen Periodenstart. Tippe weiter, um deine Tagesangaben zu starten.</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Kennst du deine Zykluslänge?</Label>
                  <RadioGroup value={knowsCycle} onValueChange={(v) => setKnowsCycle(v as "yes" | "no")}>
                    <label className="flex items-center gap-3 p-2.5 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="yes" id="kc-y" />
                      <span className="text-sm">Ja, ungefähr</span>
                    </label>
                    <label className="flex items-center gap-3 p-2.5 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="no" id="kc-n" />
                      <span className="text-sm">Ich bin mir nicht sicher, wie lange mein Zyklus geht.</span>
                    </label>
                  </RadioGroup>
                  {knowsCycle === "yes" && (
                    <div className="flex items-center gap-2 pl-2">
                      <Input type="number" min={20} max={45} value={cycleLen} onChange={e => setCycleLen(+e.target.value || 28)} className="w-24" />
                      <span className="text-sm text-muted-foreground">Tage</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label>Kennst du deine Periodendauer?</Label>
                  <RadioGroup value={knowsPeriod} onValueChange={(v) => setKnowsPeriod(v as "yes" | "no")}>
                    <label className="flex items-center gap-3 p-2.5 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="yes" id="kp-y" />
                      <span className="text-sm">Ja</span>
                    </label>
                    <label className="flex items-center gap-3 p-2.5 rounded-lg border border-border cursor-pointer hover:border-primary/40">
                      <RadioGroupItem value="no" id="kp-n" />
                      <span className="text-sm">Ich weiß nicht, wie lange meine Periode dauert.</span>
                    </label>
                  </RadioGroup>
                  {knowsPeriod === "yes" && (
                    <div className="flex items-center gap-2 pl-2">
                      <Input type="number" min={2} max={10} value={periodLen} onChange={e => setPeriodLen(+e.target.value || 5)} className="w-24" />
                      <span className="text-sm text-muted-foreground">Tage</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground italic">Standard ist 28/5 – Fravia passt sich an, je mehr du trackst.</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <Label>Daten importieren (optional)</Label>
                <p className="text-sm text-muted-foreground">Du kannst Daten aus deiner bisherigen Zyklus-App und deinem Kalender mitbringen.</p>
                <Button variant="outline" className="w-full justify-start" onClick={() => setImportOpen("csv")}>
                  <Upload className="h-4 w-4 mr-2" /> Zyklusdaten als CSV importieren
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => setImportOpen("ics")}>
                  <CalendarIcon className="h-4 w-4 mr-2" /> Termine aus .ics-Datei importieren
                </Button>
                <p className="text-xs text-muted-foreground">Beides geht später jederzeit in den Einstellungen.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={back} disabled={step === 0}>Zurück</Button>
            {step < totalSteps - 1 ? (
              <Button onClick={next} disabled={(step === 0 && !name) || (step === 1 && !phase) || (step === 2 && phase === "cycling" && !regularity)}>
                Weiter
              </Button>
            ) : (
              <Button onClick={finish}>
                <Sparkles className="h-4 w-4 mr-2" /> Los geht's
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImportDialog
        kind={importOpen}
        onOpenChange={(o) => !o && setImportOpen(null)}
        onImportLogs={onImportLogs}
        onImportEvents={onImportEvents}
      />
    </>
  );
}
