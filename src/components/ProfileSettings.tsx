import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, LogOut, Upload, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/hooks/useProfile";
import { isGuest, guestStore } from "@/lib/guestStore";
import { useNavigate } from "react-router-dom";
import { ImportDialog } from "./ImportDialog";
import { dataApi } from "@/lib/dataApi";

interface Props {
  profile: Profile;
  userId: string | null;
  onSave: (p: Partial<Profile>) => Promise<void>;
}

export function ProfileSettings({ profile, userId, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [cycleLen, setCycleLen] = useState(profile.avg_cycle_length);
  const [periodLen, setPeriodLen] = useState(profile.avg_period_length);
  const [lastPeriod, setLastPeriod] = useState(profile.last_period_start ?? "");
  const [meno, setMeno] = useState(profile.in_menopause);
  const [importKind, setImportKind] = useState<"ics" | null>(null);
  const navigate = useNavigate();
  const guest = isGuest();

  const save = async () => {
    await onSave({
      display_name: name || null,
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      last_period_start: meno ? null : (lastPeriod || null),
      in_menopause: meno,
    });
    toast.success("Gespeichert");
    setOpen(false);
  };

  const handleSignOut = async () => {
    if (guest) {
      guestStore.clearAll();
      navigate("/auth", { replace: true });
      window.location.reload();
    } else {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Settings className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" onClick={handleSignOut} title={guest ? "Lokale Daten löschen" : "Abmelden"}>
        <LogOut className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dein Zyklusprofil</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Ich bin in der Menopause</div>
                <div className="text-xs text-muted-foreground">Fravia fokussiert auf Energie & Wohlbefinden statt Zyklusphase.</div>
              </div>
              <Switch checked={meno} onCheckedChange={setMeno} />
            </div>

            {!meno && (
              <>
                <div className="space-y-2"><Label>Letzter Periodenstart</Label><Input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Zykluslänge (Tage)</Label><Input type="number" min={20} max={45} value={cycleLen} onChange={e => setCycleLen(+e.target.value)} /></div>
                  <div className="space-y-2"><Label>Periodendauer</Label><Input type="number" min={2} max={10} value={periodLen} onChange={e => setPeriodLen(+e.target.value)} /></div>
                </div>
              </>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <Label>Daten importieren</Label>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Kein Import nötig – gib einfach deinen letzten Periodenstart und deine Zykluslänge ein. Fravia lernt mit der Zeit.
              </div>
              <Button variant="outline" className="w-full justify-start" onClick={() => setImportKind("ics")}>
                <CalendarIcon className="h-4 w-4 mr-2" /> Kalender (.ics aus Google/Apple)
              </Button>
            </div>

            <Button onClick={save} className="w-full">Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportDialog
        kind={importKind}
        onOpenChange={(o) => !o && setImportKind(null)}
        onImportEvents={async (events) => {
          await dataApi.addEvents(userId, events.map(e => ({ ...e, source: "ics-import" })));
        }}
      />
    </>
  );
}
