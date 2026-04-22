import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarHeart, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { sharingApi } from "@/lib/sharingApi";
import { toast } from "sonner";

export default function AcceptShare() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/share/${token}`, { replace: true });
    }
  }, [authLoading, user, token, navigate]);

  const accept = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const share = await sharingApi.acceptByToken(token, user.id);
      if (!share) {
        toast.error("Einladung ungültig oder bereits verwendet.");
        return;
      }
      setDone(true);
      toast.success("Kalender hinzugefügt – du siehst die Termine jetzt in deinem Kalender.");
    } catch (e) {
      console.error(e);
      toast.error("Annahme fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade…</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CalendarHeart className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-xl">Kalender-Einladung</h1>
          <p className="text-sm text-muted-foreground">
            Du wurdest eingeladen, einen Luna-Kalender mit anzusehen. Termine werden nach Annahme in deinem eigenen Kalender mit angezeigt.
          </p>
        </div>
        {done ? (
          <Button className="w-full" onClick={() => navigate("/")}>Zum Kalender</Button>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={accept} disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Annehmen…</> : "Einladung annehmen"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>Abbrechen</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
