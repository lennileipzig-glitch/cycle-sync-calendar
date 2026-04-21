import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/hooks/useProfile";

export function ProfileSettings({ profile, onSave }: { profile: Profile; onSave: (p: Partial<Profile>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [cycleLen, setCycleLen] = useState(profile.avg_cycle_length);
  const [periodLen, setPeriodLen] = useState(profile.avg_period_length);
  const [lastPeriod, setLastPeriod] = useState(profile.last_period_start ?? "");

  const save = async () => {
    await onSave({
      display_name: name || null,
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      last_period_start: lastPeriod || null,
    });
    toast.success("Gespeichert");
    setOpen(false);
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Settings className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}><LogOut className="h-5 w-5" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dein Zyklusprofil</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Letzter Periodenstart</Label><Input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Zykluslänge (Tage)</Label><Input type="number" min={20} max={45} value={cycleLen} onChange={e => setCycleLen(+e.target.value)} /></div>
              <div className="space-y-2"><Label>Periodendauer</Label><Input type="number" min={2} max={10} value={periodLen} onChange={e => setPeriodLen(+e.target.value)} /></div>
            </div>
            <Button onClick={save} className="w-full">Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
