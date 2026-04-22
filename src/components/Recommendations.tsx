import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Salad, Dumbbell, Refrigerator, X, Plus, CalendarPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { PhaseInfo } from "@/lib/cycle";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { isGuest } from "@/lib/guestStore";
import { dataApi } from "@/lib/dataApi";
import { fmtDate } from "@/lib/cycle";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface RecipeItem { title: string; why: string; nutrients: string[]; uses_from_fridge?: string[]; }
interface WorkoutItem { title: string; duration: string; intensity: string; why: string; }

const FRIDGE_KEY = "luna-fridge-items";

const energyLabel = (raw?: string | null) => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return ["sehr schlecht", "schlecht", "mittel", "gut", "sehr gut"][n - 1];
  return raw;
};

const loadFridge = (): string[] => {
  try { const v = localStorage.getItem(FRIDGE_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
};

export function Recommendations({
  phase,
  energy,
  symptoms,
  selectedDate,
  userId,
  onEventAdded,
}: {
  phase: PhaseInfo;
  energy?: string | null;
  symptoms?: string[];
  selectedDate: Date;
  userId: string | null;
  onEventAdded?: () => void;
}) {
  const { user, guestMode } = useAuth();
  const { profile } = useProfile(user?.id, guestMode || isGuest());
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [loadingW, setLoadingW] = useState(false);
  const [fridge, setFridge] = useState<string[]>(loadFridge());
  const [fridgeInput, setFridgeInput] = useState("");

  useEffect(() => { localStorage.setItem(FRIDGE_KEY, JSON.stringify(fridge)); }, [fridge]);

  const addFridge = (raw: string) => {
    const v = raw.trim();
    if (!v || fridge.includes(v)) return;
    setFridge([...fridge, v]);
    setFridgeInput("");
  };
  const removeFridge = (v: string) => setFridge(fridge.filter(x => x !== v));

  const fetchRec = async (kind: "recipes" | "workouts") => {
    const setLoading = kind === "recipes" ? setLoadingR : setLoadingW;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cycle-recommendations", {
        body: {
          phase: phase.label,
          energy: energyLabel(energy),
          symptoms,
          kind,
          ...(kind === "recipes" ? {
            fridge,
            dietStyle: profile?.diet_style,
            intolerances: profile?.diet_intolerances ?? [],
            favoriteFoods: profile?.favorite_foods ?? [],
          } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (kind === "recipes") setRecipes(data.items ?? []);
      else setWorkouts(data.items ?? []);
    } catch {
      toast.error("Empfehlungen konnten nicht geladen werden");
    } finally { setLoading(false); }
  };

  useEffect(() => { setRecipes([]); setWorkouts([]); }, [phase.phase, energy, JSON.stringify(symptoms)]);

  const personalNote = () => {
    const parts: string[] = [];
    if (energy) parts.push(`Energie: ${energyLabel(energy)}`);
    if (symptoms && symptoms.length > 0) parts.push(`Beschwerden: ${symptoms.slice(0, 3).join(", ")}`);
    return parts.join(" · ");
  };

  return (
    <div className="space-y-2">
      {personalNote() && (
        <p className="text-xs text-muted-foreground italic px-1">
          Vorschläge berücksichtigen: {personalNote()}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 bg-gradient-warm/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-lg"><Salad className="h-5 w-5 text-primary" />Ernährung</h3>
            <Button size="sm" variant="ghost" onClick={() => fetchRec("recipes")} disabled={loadingR}>
              {loadingR ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>

          {/* Kühlschrank-Eingabe */}
          <div className="mb-4 p-3 rounded-lg bg-card/60 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Refrigerator className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">In meinem Kühlschrank</span>
            </div>
            {fridge.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fridge.map(item => (
                  <span key={item} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs bg-primary/10 border border-primary/20">
                    {item}
                    <button type="button" onClick={() => removeFridge(item)} className="h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-primary/20" aria-label={`${item} entfernen`}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                value={fridgeInput}
                onChange={e => setFridgeInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFridge(fridgeInput); } }}
                placeholder="z.B. Spinat, Eier, Kichererbsen…"
                className="h-8 text-sm"
              />
              <Button type="button" size="icon" variant="secondary" onClick={() => addFridge(fridgeInput)} className="h-8 w-8 shrink-0" aria-label="Hinzufügen">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {fridge.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 italic">Vorhandene Zutaten werden in den Rezepten bevorzugt.</p>
            )}
          </div>

          {recipes.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Was deinem Körper jetzt guttut:</p>
              <ul className="space-y-1.5 text-sm">
                {phase.nutrition.map(n => <li key={n} className="flex gap-2"><span className="text-primary">·</span>{n}</li>)}
              </ul>
              <Button variant="link" size="sm" onClick={() => fetchRec("recipes")} className="mt-3 px-0">
                <Sparkles className="h-3 w-3 mr-1" /> Personalisierte Rezepte
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {recipes.map((r, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">
                  <div className="font-medium text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.why}</div>
                  <div className="text-xs text-primary/80 mt-1">{r.nutrients.join(" · ")}</div>
                  {r.uses_from_fridge && r.uses_from_fridge.length > 0 && (
                    <div className="text-[11px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      <Refrigerator className="h-3 w-3" />
                      Aus deinem Kühlschrank: {r.uses_from_fridge.join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 bg-gradient-phase">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-lg"><Dumbbell className="h-5 w-5 text-primary" />Bewegung</h3>
            <Button size="sm" variant="ghost" onClick={() => fetchRec("workouts")} disabled={loadingW}>
              {loadingW ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
          {workouts.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Passend zu deiner Phase:</p>
              <ul className="space-y-1.5 text-sm">
                {phase.exercise.map(n => <li key={n} className="flex gap-2"><span className="text-primary">·</span>{n}</li>)}
              </ul>
              <Button variant="link" size="sm" onClick={() => fetchRec("workouts")} className="mt-3 px-0">
                <Sparkles className="h-3 w-3 mr-1" /> Personalisiertes Workout
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {workouts.map((w, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">
                  <div className="font-medium text-sm">{w.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{w.why}</div>
                  <div className="text-xs text-primary/80 mt-1">{w.duration} · {w.intensity}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
