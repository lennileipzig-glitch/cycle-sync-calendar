import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Salad, Dumbbell, Refrigerator, X, Plus, CalendarPlus, Trash2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { PhaseInfo } from "@/lib/cycle";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { isGuest, type GuestEvent } from "@/lib/guestStore";
import { dataApi } from "@/lib/dataApi";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { InlineAddMeal } from "@/components/InlineAddMeal";
import { InlineAddSport } from "@/components/InlineAddSport";
import { cn } from "@/lib/utils";
import { packMeta } from "@/lib/eventMeta";

interface RecipeIngredient { name: string; amount?: number; unit?: string }
interface RecipeItem { title: string; why: string; nutrients: string[]; uses_from_fridge?: string[]; servings?: number; ingredients?: RecipeIngredient[]; steps?: string[] }
interface WorkoutExercise { name: string; sets?: string; details?: string }
interface WorkoutItem { title: string; duration: string; intensity: string; why: string; exercises?: WorkoutExercise[] }

const intensityWord = (v: number) => {
  if (v <= 1.5) return "sehr leicht";
  if (v <= 2.5) return "leicht";
  if (v <= 3.5) return "mittel";
  if (v <= 4.5) return "intensiv";
  return "sehr intensiv";
};

const FRIDGE_KEY = "fravia-fridge-items";

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
  dayEvents = [],
  onEditEvent,
}: {
  phase: PhaseInfo;
  energy?: string | null;
  symptoms?: string[];
  selectedDate: Date;
  userId: string | null;
  onEventAdded?: () => void;
  dayEvents?: GuestEvent[];
  onEditEvent?: (e: GuestEvent) => void;
}) {
  const { user, guestMode } = useAuth();
  const { profile } = useProfile(user?.id, guestMode || isGuest());
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [loadingW, setLoadingW] = useState(false);
  const [fridge, setFridge] = useState<string[]>(loadFridge());
  const [fridgeInput, setFridgeInput] = useState("");
  const [openRecipe, setOpenRecipe] = useState<RecipeItem | null>(null);
  const [recipeServings, setRecipeServings] = useState<number>(2);
  const [openWorkout, setOpenWorkout] = useState<WorkoutItem | null>(null);
  const meals = dayEvents.filter(e => e.category === "mahlzeit");
  const sports = dayEvents.filter(e => e.category === "sport");

  const handleDelete = async (id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    try {
      await dataApi.deleteEvent(userId, id);
      onEventAdded?.();
    } catch (e) { console.error(e); }
  };

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

  const dayLabel = format(selectedDate, "EEEE, d. MMM", { locale: de });

  const addRecipeToDay = async (r: RecipeItem) => {
    const start = new Date(selectedDate); start.setHours(12, 0, 0, 0);
    const end = new Date(selectedDate); end.setHours(13, 0, 0, 0);
    const detailsParts: string[] = [r.why];
    if (r.nutrients?.length) detailsParts.push(`Nährstoffe: ${r.nutrients.join(", ")}`);
    if (r.uses_from_fridge?.length) detailsParts.push(`Aus Kühlschrank: ${r.uses_from_fridge.join(", ")}`);
    const details = packMeta(detailsParts.join("\n"), {
      kind: "recipe",
      servings: r.servings ?? 2,
      ingredients: r.ingredients,
      steps: r.steps,
      nutrients: r.nutrients,
      uses_from_fridge: r.uses_from_fridge,
      why: r.why,
    });
    await dataApi.addEvents(userId, [{
      title: r.title,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      location: null,
      source: "ai-recipe",
      energy_cost: 1.5,
      is_flexible: false,
      recurrence_freq: null,
      recurrence_until: null,
      category: "mahlzeit",
      details,
    }]);
    toast.success(`„${r.title}" zu ${dayLabel} hinzugefügt`);
    onEventAdded?.();
  };

  const addWorkoutToDay = async (w: WorkoutItem) => {
    const start = new Date(selectedDate); start.setHours(18, 0, 0, 0);
    const minMatch = /(\d+)/.exec(w.duration);
    const minutes = minMatch ? Math.min(180, parseInt(minMatch[1], 10)) : 45;
    const end = new Date(start.getTime() + minutes * 60_000);
    const intensityCost = w.intensity === "intensiv" ? 4.5 : w.intensity === "moderat" ? 3.5 : 2.5;
    const details = packMeta(`${w.why}\nDauer: ${w.duration} · Intensität: ${w.intensity}`, {
      kind: "workout",
      duration: w.duration,
      intensity: w.intensity,
      why: w.why,
      exercises: w.exercises,
    });
    await dataApi.addEvents(userId, [{
      title: w.title,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      location: null,
      source: "ai-workout",
      energy_cost: intensityCost,
      is_flexible: false,
      recurrence_freq: null,
      recurrence_until: null,
      category: "sport",
      details,
    }]);
    toast.success(`„${w.title}" zu ${dayLabel} hinzugefügt`);
    onEventAdded?.();
  };

  const personalNote = () => {
    const parts: string[] = [];
    if (energy) parts.push(`Energie: ${energyLabel(energy)}`);
    if (symptoms && symptoms.length > 0) parts.push(`Beschwerden: ${symptoms.slice(0, 3).join(", ")}`);
    return parts.join(" · ");
  };

  const baseServings = openRecipe?.servings && openRecipe.servings > 0 ? openRecipe.servings : 2;
  const servingFactor = openRecipe ? recipeServings / baseServings : 1;
  const fmtAmount = (n: number) => {
    if (!isFinite(n)) return "";
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
  };

  return (
    <div className="space-y-2">
      {personalNote() && (
        <p className="text-xs text-muted-foreground italic px-1">
          Vorschläge berücksichtigen: {personalNote()}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {/* === ERNÄHRUNG (Salbei) === */}
        <Card
          className="p-5 border-2 space-y-4"
          style={{
            background: "hsl(var(--tile-nutrition) / 0.18)",
            borderColor: "hsl(var(--tile-nutrition) / 0.45)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg" style={{ color: "hsl(var(--tile-nutrition))" }}>
              <Salad className="h-5 w-5" />Ernährung
            </h3>
          </div>

          {/* 1. Mahlzeit aktiv hinzufügen */}
          <div className="rounded-lg bg-card/70 border border-border/50 p-3 space-y-3">
            <div className="text-xs font-medium text-foreground/80">Mahlzeit für heute eintragen</div>
            {meals.length > 0 && (
              <ul className="space-y-1">
                {meals.map(m => (
                  <li key={m.id} className="group flex items-start gap-2 text-sm rounded-md px-2 py-1 -mx-1 hover:bg-foreground/5">
                    <button
                      type="button"
                      onClick={() => onEditEvent?.(m)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium truncate text-sm">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.all_day ? "Ganztägig" : format(new Date(m.starts_at), "HH:mm")}
                        {m.details && ` · ${m.details.split("\n")[0].slice(0, 50)}`}
                      </div>
                    </button>
                    {!m._shared_owner_name && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        aria-label="Mahlzeit löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <InlineAddMeal userId={userId} date={selectedDate} onCreated={onEventAdded} />
          </div>

          {/* 2. Kühlschrank */}
          <div className="rounded-lg bg-card/70 border border-border/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Refrigerator className="h-4 w-4" style={{ color: "hsl(var(--tile-nutrition))" }} />
              <span className="text-xs font-medium">In meinem Kühlschrank</span>
            </div>
            {fridge.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fridge.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs border"
                    style={{
                      background: "hsl(var(--tile-nutrition) / 0.15)",
                      borderColor: "hsl(var(--tile-nutrition) / 0.35)",
                    }}
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeFridge(item)}
                      className="h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-foreground/10"
                      aria-label={`${item} entfernen`}
                    >
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
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => addFridge(fridgeInput)}
                className="h-8 w-8 shrink-0"
                aria-label="Hinzufügen"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {fridge.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                Vorhandene Zutaten werden in den Rezept-Vorschlägen bevorzugt.
              </p>
            )}
          </div>

          {/* 3. Phasen-Empfehlungen */}
          <div>
            <div className="text-xs font-medium mb-2 text-foreground/80">
              Was deinem Körper in dieser Phase guttut
            </div>
            <ul className="space-y-1 text-sm">
              {phase.nutrition.length === 0 ? (
                <li className="text-muted-foreground text-xs italic">Trage deinen letzten Zyklusstart ein.</li>
              ) : phase.nutrition.map(n => (
                <li key={n} className="flex gap-2">
                  <span style={{ color: "hsl(var(--tile-nutrition))" }}>·</span>{n}
                </li>
              ))}
            </ul>
          </div>

          {/* 4. KI-Rezepte */}
          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRec("recipes")}
              disabled={loadingR}
              className="w-full"
              style={{ borderColor: "hsl(var(--tile-nutrition) / 0.5)" }}
            >
              {loadingR
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Suche Rezepte…</>
                : <><Sparkles className="h-4 w-4 mr-2" /> Personalisierte Rezepte vorschlagen</>}
            </Button>
            {recipes.length > 0 && (
              <ul className="space-y-3 mt-3">
                {recipes.map((r, i) => (
                  <li
                    key={i}
                    className="border-l-2 pl-3 cursor-pointer rounded-r-md hover:bg-accent/40 transition-colors py-1"
                    style={{ borderColor: "hsl(var(--tile-nutrition) / 0.6)" }}
                    onClick={() => { setOpenRecipe(r); setRecipeServings(r.servings && r.servings > 0 ? r.servings : 2); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm flex items-center gap-1">
                        {r.title}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] -mr-2 shrink-0"
                        onClick={(e) => { e.stopPropagation(); addRecipeToDay(r); }}
                      >
                        <CalendarPlus className="h-3 w-3 mr-1" /> Zum Tag
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.why}</div>
                    <div className="text-xs mt-1" style={{ color: "hsl(var(--tile-nutrition))" }}>
                      {r.nutrients.join(" · ")}
                    </div>
                    {r.uses_from_fridge && r.uses_from_fridge.length > 0 && (
                      <div
                        className="text-[11px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                        style={{
                          background: "hsl(var(--tile-nutrition) / 0.18)",
                          color: "hsl(var(--tile-nutrition))",
                        }}
                      >
                        <Refrigerator className="h-3 w-3" />
                        Aus deinem Kühlschrank: {r.uses_from_fridge.join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* === BEWEGUNG (Teal) === */}
        <Card
          className="p-5 border-2 space-y-4"
          style={{
            background: "hsl(var(--tile-movement) / 0.18)",
            borderColor: "hsl(var(--tile-movement) / 0.45)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg" style={{ color: "hsl(var(--tile-movement))" }}>
              <Dumbbell className="h-5 w-5" />Bewegung
            </h3>
          </div>

          {/* 1. Sport aktiv hinzufügen */}
          <div className="rounded-lg bg-card/70 border border-border/50 p-3 space-y-3">
            <div className="text-xs font-medium text-foreground/80">Sport / Bewegung für heute eintragen</div>
            {sports.length > 0 && (
              <ul className="space-y-1">
                {sports.map(s => (
                  <li key={s.id} className="group flex items-start gap-2 text-sm rounded-md px-2 py-1 -mx-1 hover:bg-foreground/5">
                    <button
                      type="button"
                      onClick={() => onEditEvent?.(s)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium truncate text-sm">{s.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.all_day ? "Ganztägig" : format(new Date(s.starts_at), "HH:mm")}
                        {typeof s.energy_cost === "number" && ` · ${intensityWord(s.energy_cost)}`}
                        {s.details && ` · ${s.details.split("\n")[0].slice(0, 40)}`}
                      </div>
                    </button>
                    {!s._shared_owner_name && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        aria-label="Sport löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <InlineAddSport userId={userId} date={selectedDate} onCreated={onEventAdded} />
          </div>

          {/* 2. Phasen-Empfehlungen */}
          <div>
            <div className="text-xs font-medium mb-2 text-foreground/80">
              Passend zu deiner Zyklusphase
            </div>
            <ul className="space-y-1 text-sm">
              {phase.exercise.length === 0 ? (
                <li className="text-muted-foreground text-xs italic">Trage deinen letzten Zyklusstart ein.</li>
              ) : phase.exercise.map(n => (
                <li key={n} className="flex gap-2">
                  <span style={{ color: "hsl(var(--tile-movement))" }}>·</span>{n}
                </li>
              ))}
            </ul>
          </div>

          {/* 3. KI-Workouts */}
          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRec("workouts")}
              disabled={loadingW}
              className="w-full"
              style={{ borderColor: "hsl(var(--tile-movement) / 0.5)" }}
            >
              {loadingW
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Suche Workouts…</>
                : <><Sparkles className="h-4 w-4 mr-2" /> Personalisiertes Workout vorschlagen</>}
            </Button>
            {workouts.length > 0 && (
              <ul className="space-y-3 mt-3">
                {workouts.map((w, i) => (
                  <li
                    key={i}
                    className="border-l-2 pl-3 cursor-pointer rounded-r-md hover:bg-accent/40 transition-colors py-1"
                    style={{ borderColor: "hsl(var(--tile-movement) / 0.6)" }}
                    onClick={() => setOpenWorkout(w)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm flex items-center gap-1">
                        {w.title}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] -mr-2 shrink-0"
                        onClick={(e) => { e.stopPropagation(); addWorkoutToDay(w); }}
                      >
                        <CalendarPlus className="h-3 w-3 mr-1" /> Zum Tag
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{w.why}</div>
                    <div className="text-xs mt-1" style={{ color: "hsl(var(--tile-movement))" }}>
                      {w.duration} · {w.intensity}
                      {w.exercises && w.exercises.length > 0 && ` · ${w.exercises.length} Übungen`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={!!openRecipe} onOpenChange={(o) => { if (!o) setOpenRecipe(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {openRecipe && (
            <>
              <DialogHeader>
                <DialogTitle>{openRecipe.title}</DialogTitle>
                <DialogDescription>{openRecipe.why}</DialogDescription>
              </DialogHeader>

              <Card className="p-3 flex items-center justify-between">
                <Label className="text-xs">Portionen</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRecipeServings(s => Math.max(1, s - 1))}
                  >
                    –
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{recipeServings}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRecipeServings(s => Math.min(20, s + 1))}
                  >
                    +
                  </Button>
                </div>
              </Card>

              {openRecipe.ingredients && openRecipe.ingredients.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Zutaten</h4>
                  <ul className="text-sm space-y-1">
                    {openRecipe.ingredients.map((ing, j) => (
                      <li key={j} className="flex justify-between gap-3 border-b border-border/40 py-1">
                        <span>{ing.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {ing.amount != null ? `${fmtAmount(ing.amount * servingFactor)}${ing.unit ? " " + ing.unit : ""}` : (ing.unit ?? "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {openRecipe.steps && openRecipe.steps.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Zubereitung</h4>
                  <ol className="text-sm space-y-1.5 list-decimal pl-5">
                    {openRecipe.steps.map((s, j) => <li key={j}>{s}</li>)}
                  </ol>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenRecipe(null)}>Schließen</Button>
                <Button
                  onClick={() => { addRecipeToDay(openRecipe); setOpenRecipe(null); }}
                  style={{ background: "hsl(var(--tile-nutrition))", color: "hsl(var(--tile-nutrition-foreground, var(--background)))" }}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" /> Zum Tag hinzufügen
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
