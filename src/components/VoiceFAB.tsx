import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Sparkles, X, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { dataApi } from "@/lib/dataApi";
import type { GuestEvent } from "@/lib/guestStore";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { getPhase } from "@/lib/cycle";
import type { Profile } from "@/hooks/useProfile";

type CategoryOption = "termin" | "todo" | "sport" | "ernaehrung";

type VoiceAction =
  | { action: "add_meal" | "add_sport" | "add_appointment"; payload: { title: string; date: string; time: string; duration_min?: number; energy_cost?: number; location?: string; details?: string; confidence: "high" | "medium" | "low"; spoken_summary: string } }
  | { action: "smart_plan_sport" | "smart_plan_meal"; payload: { title: string; date: string; time: string; duration_min?: number; energy_cost?: number; reasoning: string; confidence: "high" | "medium" | "low"; spoken_summary: string } }
  | { action: "suggest_recipe"; payload: { recipes: { title: string; why: string; uses_from_fridge?: string[]; short_steps?: string; servings?: number; ingredients?: { name: string; amount?: number; unit?: string }[]; steps?: string[] }[]; spoken_summary: string } }
  | { action: "clarify_category"; payload: { question: string; options: CategoryOption[]; suggested_title?: string; suggested_date?: string; suggested_time?: string; spoken_summary: string } }
  | { action: "clarify"; payload: { question: string; spoken_summary: string } };

const CATEGORY_LABELS: Record<CategoryOption, string> = {
  termin: "Termin",
  todo: "To-do",
  sport: "Bewegung",
  ernaehrung: "Ernährung",
};

interface Props {
  userId: string | null;
  profile: Profile;
  onChanged: () => void | Promise<void>;
}

const FRIDGE_KEY = "fravia-fridge-items";

// Web Speech API Typdefinition (minimal)
interface SpeechRecognitionEventLike { results: { length: number; isFinal?: boolean; [i: number]: { 0: { transcript: string }; isFinal: boolean } } }
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function VoiceFAB({ userId, profile, onChanged }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<VoiceAction | null>(null);
  const [editMode, setEditMode] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) {
      toast({ title: "Sprache nicht unterstützt", description: "Bitte Chrome/Edge nutzen oder den Text manuell eingeben.", variant: "destructive" });
      return;
    }
    setTranscript(""); setInterim("");
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition!;
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let finalText = ""; let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript(prev => (prev + " " + finalText).trim());
      setInterim(interimText);
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast({ title: "Aufnahme-Fehler", description: e.error, variant: "destructive" });
      }
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [speechSupported, toast]);

  // Beim Öffnen direkt aufnehmen
  useEffect(() => {
    if (open && !listening && !transcript && !processing && !pendingAction) {
      startListening();
    }
    if (!open) {
      stopListening();
      setTranscript(""); setInterim(""); setPendingAction(null); setProcessing(false); setEditMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buildContext = useCallback(async () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const allEvents = await dataApi.getEvents(userId);
    const inWeek = allEvents.filter(e => {
      const d = new Date(e.starts_at);
      return d >= today && d <= addDays(today, 7);
    }).map(e => ({
      date: e.starts_at.slice(0, 10),
      time: e.starts_at.slice(11, 16),
      title: e.title,
      category: e.category ?? "termin",
      energy_cost: e.energy_cost ?? null,
    }));
    const log = await dataApi.getLog(userId, todayStr);
    const phase = getPhase(today, profile.last_period_start ? new Date(profile.last_period_start) : null, profile.avg_cycle_length, profile.avg_period_length, profile.cycle_irregular);
    let fridge: string[] = [];
    try { fridge = JSON.parse(localStorage.getItem(FRIDGE_KEY) || "[]"); } catch { fridge = []; }
    return {
      today: todayStr,
      currentTime: format(today, "HH:mm"),
      weekday: format(today, "EEEE", { locale: de }),
      phase: phase.label,
      energy: log?.energy_level ?? null,
      upcomingEvents: inWeek,
      fridge,
      dietStyle: profile.diet_style,
      intolerances: profile.diet_intolerances,
      favoriteSports: profile.sports,
      sportLevel: profile.sport_level,
    };
  }, [userId, profile]);

  const sendToAssistant = useCallback(async (text: string) => {
    setProcessing(true);
    try {
      const context = await buildContext();
      const { data, error } = await supabase.functions.invoke("voice-assistant", {
        body: { transcript: text, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data as VoiceAction;

      if (result.action === "clarify") {
        toast({ title: "Fravia fragt nach", description: result.payload.question });
        setProcessing(false);
        setTranscript(""); // erlauben, neu zu sprechen
        return;
      }

      if (result.action === "clarify_category") {
        // Auswahl im Dialog anzeigen – Userin entscheidet manuell.
        setPendingAction(result);
        setProcessing(false);
        return;
      }

      if (result.action === "suggest_recipe") {
        // Rezeptvorschläge nur anzeigen, nicht buchen
        setPendingAction(result);
        setProcessing(false);
        return;
      }

      // Termin-/Mahlzeit-/Sport-Aktionen: IMMER Bestätigung anzeigen
      setPendingAction(result);
      setProcessing(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Fehler", description: e instanceof Error ? e.message : "Unbekannt", variant: "destructive" });
      setProcessing(false);
    }
  }, [buildContext, toast]);

  // Handhabt die Auswahl in der Kategorie-Rückfrage
  const handleCategoryChoice = useCallback(async (choice: CategoryOption) => {
    if (!pendingAction || pendingAction.action !== "clarify_category") return;
    const p = pendingAction.payload;
    const today = format(new Date(), "yyyy-MM-dd");
    const date = p.suggested_date ?? today;
    const title = p.suggested_title ?? (transcript.trim().slice(0, 80) || "Neuer Eintrag");

    // To-do direkt anlegen (ohne Edge-Function-Roundtrip)
    if (choice === "todo") {
      try {
        await dataApi.addTodo(userId, date, title);
        await onChanged();
        toast({ title: "To-do angelegt", description: `${title} · ${format(new Date(date), "EEE d.M.", { locale: de })}` });
        setPendingAction(null);
        setOpen(false);
      } catch (e) {
        toast({ title: "Fehler", description: e instanceof Error ? e.message : "Unbekannt", variant: "destructive" });
      }
      return;
    }

    // Für Termin/Sport/Ernährung: Assistent erneut bitten – mit fixierter Kategorie
    const categoryHint =
      choice === "sport" ? "Es ist eine Sport-/Bewegungseinheit." :
      choice === "ernaehrung" ? "Es ist eine Mahlzeit." :
      "Es ist ein normaler Termin.";
    const followUp = `${transcript.trim()} (Hinweis von der Nutzerin: ${categoryHint})`;
    setPendingAction(null);
    await sendToAssistant(followUp);
  }, [pendingAction, transcript, userId, onChanged, toast, sendToAssistant]);

  const executeAction = useCallback(async (act: VoiceAction) => {
    if (act.action === "clarify" || act.action === "clarify_category" || act.action === "suggest_recipe") return;
    const p = act.payload;
    const category: "termin" | "mahlzeit" | "sport" =
      act.action === "add_meal" || act.action === "smart_plan_meal" ? "mahlzeit" :
      act.action === "add_sport" || act.action === "smart_plan_sport" ? "sport" : "termin";
    const startsAt = new Date(`${p.date}T${p.time}:00`);
    const dur = "duration_min" in p && p.duration_min ? p.duration_min : (category === "mahlzeit" ? 30 : category === "sport" ? 60 : 60);
    const endsAt = new Date(startsAt.getTime() + dur * 60_000);

    const eventInput: Omit<GuestEvent, "id"> = {
      title: p.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: false,
      location: ("location" in p && p.location) ? p.location : null,
      source: "voice",
      energy_cost: ("energy_cost" in p && p.energy_cost) ? p.energy_cost : null,
      category,
      details: ("details" in p && p.details) ? p.details : (("reasoning" in p && p.reasoning) ? p.reasoning : null),
    };

    const inserted = await dataApi.addEvents(userId, [eventInput]);
    await onChanged();

    // Toast mit Undo
    const undoEventId = (inserted as unknown as { id?: string }[] | undefined)?.[0]?.id;
    toast({
      title: "Eingetragen",
      description: `${p.title} · ${format(startsAt, "EEE d.M., HH:mm", { locale: de })}`,
      action: undoEventId ? (
        <Button variant="ghost" size="sm" onClick={async () => {
          await dataApi.deleteEvent(userId, undoEventId);
          await onChanged();
        }}>Rückgängig</Button>
      ) : undefined,
    });
    setPendingAction(null);
    setProcessing(false);
    setOpen(false);
  }, [userId, onChanged, toast]);

  const handleSubmitTranscript = useCallback(() => {
    if (!transcript.trim()) return;
    stopListening();
    sendToAssistant(transcript.trim());
  }, [transcript, sendToAssistant, stopListening]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        aria-label="Fravia per Sprache steuern"
      >
        <Mic className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sprich mit Fravia
            </DialogTitle>
            <DialogDescription>
              Z. B. „Ich habe morgen 18 Uhr Yoga“ oder „Schlag mir ein Rezept mit Spinat vor“.
            </DialogDescription>
          </DialogHeader>

          {!pendingAction && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="voice-transcript" className="text-xs text-muted-foreground">
                  Transkript {listening && <span className="italic">· Ich höre dich…</span>}
                </Label>
                <Textarea
                  id="voice-transcript"
                  value={transcript + (interim ? " " + interim : "")}
                  onChange={(e) => { setTranscript(e.target.value); setInterim(""); }}
                  placeholder="Tippe auf das Mikrofon und sprich – oder schreibe direkt hier rein."
                  className="min-h-[110px] bg-muted/40"
                />
                <p className="text-[11px] text-muted-foreground">Tipp: Du kannst den Text vor dem Senden noch anpassen (z. B. Uhrzeit korrigieren).</p>
              </div>

              <div className="flex items-center justify-center gap-2">
                {!listening ? (
                  <Button onClick={startListening} disabled={processing} className="rounded-full" size="lg">
                    <Mic className="h-4 w-4 mr-2" /> {transcript ? "Weiter sprechen" : "Aufnehmen"}
                  </Button>
                ) : (
                  <Button onClick={stopListening} variant="secondary" className="rounded-full" size="lg">
                    <MicOff className="h-4 w-4 mr-2" /> Stop
                  </Button>
                )}
                <Button
                  onClick={handleSubmitTranscript}
                  disabled={!transcript.trim() || processing || listening}
                  className="rounded-full"
                  size="lg"
                >
                  {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Senden
                </Button>
              </div>
            </div>
          )}

          {pendingAction && pendingAction.action === "suggest_recipe" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{pendingAction.payload.spoken_summary}</p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {pendingAction.payload.recipes.map((r, i) => (
                  <Card key={i} className="p-3">
                    <h4 className="font-medium text-sm">{r.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{r.why}</p>
                    {r.uses_from_fridge && r.uses_from_fridge.length > 0 && (
                      <p className="text-xs mt-1.5"><span className="text-muted-foreground">Aus deinem Kühlschrank: </span>{r.uses_from_fridge.join(", ")}</p>
                    )}
                    {r.short_steps && <p className="text-xs mt-1.5">{r.short_steps}</p>}
                  </Card>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPendingAction(null); setTranscript(""); }}>
                  Nochmal sprechen
                </Button>
                <Button onClick={() => setOpen(false)}>Schließen</Button>
              </DialogFooter>
            </div>
          )}

          {pendingAction && pendingAction.action === "clarify_category" && (
            <div className="space-y-3">
              <Card className="p-4 bg-primary/5 border-primary/30">
                <p className="text-sm font-medium">{pendingAction.payload.question}</p>
                <p className="text-xs text-muted-foreground mt-1">Wozu passt das am besten?</p>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                {pendingAction.payload.options.map((opt) => (
                  <Button
                    key={opt}
                    variant="secondary"
                    onClick={() => handleCategoryChoice(opt)}
                    disabled={processing}
                    className="h-12"
                  >
                    {CATEGORY_LABELS[opt]}
                  </Button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPendingAction(null); setTranscript(""); }}>
                  <X className="h-4 w-4 mr-1" /> Abbrechen
                </Button>
              </DialogFooter>
            </div>
          )}

          {pendingAction && pendingAction.action !== "suggest_recipe" && pendingAction.action !== "clarify" && pendingAction.action !== "clarify_category" && (
            <div className="space-y-3">
              {!editMode ? (
                <Card className="p-4 bg-primary/5 border-primary/30">
                  <p className="text-sm font-medium">{pendingAction.payload.spoken_summary}</p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    <p>📅 {format(new Date(`${pendingAction.payload.date}T${pendingAction.payload.time}:00`), "EEEE, d. MMMM · HH:mm 'Uhr'", { locale: de })}</p>
                    <p>📝 {pendingAction.payload.title}</p>
                    {"duration_min" in pendingAction.payload && pendingAction.payload.duration_min && (
                      <p>⏱️ {pendingAction.payload.duration_min} Min.</p>
                    )}
                    {"location" in pendingAction.payload && pendingAction.payload.location && (
                      <p>📍 {pendingAction.payload.location}</p>
                    )}
                    {"reasoning" in pendingAction.payload && pendingAction.payload.reasoning && (
                      <p className="italic mt-1">💡 {pendingAction.payload.reasoning}</p>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-4 bg-primary/5 border-primary/30 space-y-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="edit-title" className="text-xs">Titel</Label>
                    <Input
                      id="edit-title"
                      value={pendingAction.payload.title}
                      onChange={(e) => setPendingAction({ ...pendingAction, payload: { ...pendingAction.payload, title: e.target.value } } as VoiceAction)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="edit-date" className="text-xs">Datum</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={pendingAction.payload.date}
                        onChange={(e) => setPendingAction({ ...pendingAction, payload: { ...pendingAction.payload, date: e.target.value } } as VoiceAction)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-time" className="text-xs">Uhrzeit</Label>
                      <Input
                        id="edit-time"
                        type="time"
                        value={pendingAction.payload.time}
                        onChange={(e) => setPendingAction({ ...pendingAction, payload: { ...pendingAction.payload, time: e.target.value } } as VoiceAction)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-duration" className="text-xs">Dauer (Min.)</Label>
                    <Input
                      id="edit-duration"
                      type="number"
                      min={5}
                      step={5}
                      value={("duration_min" in pendingAction.payload && pendingAction.payload.duration_min) || ""}
                      onChange={(e) => setPendingAction({ ...pendingAction, payload: { ...pendingAction.payload, duration_min: e.target.value ? Number(e.target.value) : undefined } } as VoiceAction)}
                    />
                  </div>
                  {"location" in pendingAction.payload && (
                    <div className="space-y-1">
                      <Label htmlFor="edit-location" className="text-xs">Ort</Label>
                      <Input
                        id="edit-location"
                        value={pendingAction.payload.location ?? ""}
                        onChange={(e) => setPendingAction({ ...pendingAction, payload: { ...pendingAction.payload, location: e.target.value } } as VoiceAction)}
                      />
                    </div>
                  )}
                </Card>
              )}
              <DialogFooter className="flex-wrap gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => { setPendingAction(null); setEditMode(false); setTranscript(""); }}>
                  <X className="h-4 w-4 mr-1" /> Verwerfen
                </Button>
                <Button variant="secondary" onClick={() => setEditMode((v) => !v)}>
                  <Pencil className="h-4 w-4 mr-1" /> {editMode ? "Fertig" : "Bearbeiten"}
                </Button>
                <Button onClick={() => { setEditMode(false); executeAction(pendingAction); }} disabled={processing}>
                  {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Ja, eintragen
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
