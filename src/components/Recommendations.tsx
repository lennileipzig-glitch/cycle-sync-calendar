import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Salad, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import type { PhaseInfo } from "@/lib/cycle";

interface RecipeItem { title: string; why: string; nutrients: string[]; }
interface WorkoutItem { title: string; duration: string; intensity: string; why: string; }

export function Recommendations({ phase, energy, symptoms }: { phase: PhaseInfo; energy?: string | null; symptoms?: string[] }) {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [loadingW, setLoadingW] = useState(false);

  const fetchRec = async (kind: "recipes" | "workouts") => {
    const setLoading = kind === "recipes" ? setLoadingR : setLoadingW;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cycle-recommendations", {
        body: { phase: phase.label, energy, symptoms, kind },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (kind === "recipes") setRecipes(data.items ?? []);
      else setWorkouts(data.items ?? []);
    } catch (e) {
      toast.error("Empfehlungen konnten nicht geladen werden");
    } finally { setLoading(false); }
  };

  useEffect(() => { setRecipes([]); setWorkouts([]); }, [phase.phase]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5 bg-gradient-warm/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-lg"><Salad className="h-5 w-5 text-primary" />Ernährung</h3>
          <Button size="sm" variant="ghost" onClick={() => fetchRec("recipes")} disabled={loadingR}>
            {loadingR ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
        {recipes.length === 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-3">Was deinem Körper jetzt guttut:</p>
            <ul className="space-y-1.5 text-sm">
              {phase.nutrition.map(n => <li key={n} className="flex gap-2"><span className="text-primary">·</span>{n}</li>)}
            </ul>
            <Button variant="link" size="sm" onClick={() => fetchRec("recipes")} className="mt-3 px-0">
              <Sparkles className="h-3 w-3 mr-1" /> KI-Rezepte vorschlagen
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {recipes.map((r, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3">
                <div className="font-medium text-sm">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.why}</div>
                <div className="text-xs text-primary/80 mt-1">{r.nutrients.join(" · ")}</div>
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
              <Sparkles className="h-3 w-3 mr-1" /> KI-Workout vorschlagen
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
  );
}
