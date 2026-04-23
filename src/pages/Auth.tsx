import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: name } },
        });
        if (error) throw error;
        toast.success("Willkommen! Du bist eingeloggt.");
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Etwas ging schief");
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    localStorage.setItem("luna-guest-mode", "1");
    if (!localStorage.getItem("luna-guest-profile")) {
      localStorage.setItem(
        "luna-guest-profile",
        JSON.stringify({
          display_name: name || "Gast",
          avg_cycle_length: 28,
          avg_period_length: 5,
          last_period_start: null,
          onboarding_completed: false,
          in_menopause: false,
        }),
      );
    }
    // Trigger storage listener in same tab
    window.dispatchEvent(new Event("storage"));
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-warm">
      <Card className="w-full max-w-md p-8 shadow-elevated animate-scale-in">
        <div className="mb-8 text-center">
          <h1 className="text-3xl mb-2">Fravia</h1>
          <p className="text-sm text-muted-foreground">Plane deine Woche im Einklang mit deinem Zyklus.</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full mb-4"
          onClick={continueAsGuest}
        >
          <Sparkles className="h-4 w-4 mr-2" /> Ohne Account fortfahren
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">oder mit Account</span></div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Wie heißt du?</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Passwort</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Moment..." : mode === "signup" ? "Konto erstellen" : "Anmelden"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signup" ? "Schon ein Konto? Anmelden" : "Neu hier? Konto erstellen"}
        </button>
      </Card>
    </div>
  );
}
