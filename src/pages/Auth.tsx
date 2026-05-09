import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

import { lovable } from "@/integrations/lovable";

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
          className="w-full mb-2"
          onClick={async () => {
            const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
            if (res.error) toast.error(res.error.message ?? "Google-Anmeldung fehlgeschlagen");
          }}
        >
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          Mit Google anmelden
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
            <PasswordInput id="pw" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
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
      <div className="fixed bottom-4 inset-x-0 flex justify-center gap-4 text-xs text-muted-foreground">
        <a href="/datenschutz" className="hover:text-foreground underline-offset-4 hover:underline">Datenschutzerklärung</a>
        <span aria-hidden>·</span>
        <a href="/impressum" className="hover:text-foreground underline-offset-4 hover:underline">Impressum</a>
      </div>
    </div>
  );
}
