import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/cycle";
import { dataApi } from "@/lib/dataApi";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  userId: string | null;
  date: Date;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function TodoDialog({ userId, date, open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setTitle(""); }, [open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein.");
      return;
    }
    setSaving(true);
    try {
      await dataApi.addTodo(userId, fmtDate(date), title.trim());
      toast.success("Aufgabe hinzugefügt");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Aufgabe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground capitalize">
            für {format(date, "EEEE, d. MMMM", { locale: de })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="todo-title">Aufgabe</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
              placeholder="z. B. Wasser trinken, Spaziergang"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichere…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
