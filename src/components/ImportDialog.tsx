import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseICS } from "@/lib/icsParser";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  kind: "ics" | null;
  onOpenChange: (open: boolean) => void;
  onImportEvents?: (events: { title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null }[]) => Promise<void> | void;
}

export function ImportDialog({ kind, onOpenChange, onImportEvents }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string>("");

  const open = kind !== null;

  const handleFile = async (file: File) => {
    setBusy(true);
    setPreview("");
    try {
      const text = await file.text();
      const events = parseICS(text);
      if (events.length === 0) throw new Error("Keine Termine in der Datei gefunden.");
      await onImportEvents?.(events.map(({ external_uid, ...e }) => e));
      setPreview(`${events.length} Termine importiert.`);
      toast.success(`${events.length} Termine importiert`);
      setTimeout(() => onOpenChange(false), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kalender importieren</DialogTitle>
          <DialogDescription>
            Exportiere deinen Kalender als .ics-Datei aus Google Calendar oder Apple Kalender und lade sie hier hoch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full" size="lg">
            <Upload className="h-4 w-4 mr-2" /> {busy ? "Importiere..." : ".ics-Datei auswählen"}
          </Button>
          {preview && <p className="text-sm text-center text-muted-foreground">{preview}</p>}

          <div className="space-y-3 text-xs text-muted-foreground rounded-lg border border-border p-3">
            <div>
              <div className="font-medium text-foreground mb-1">Apple Kalender</div>
              <ol className="space-y-1 pl-4 list-decimal">
                <li>Öffne die Apple Kalender App auf deinem Mac.</li>
                <li>Gehe auf <b>Ablage → Exportieren → Exportieren</b> – eine .ics-Datei wird gespeichert.</li>
                <li>Lade die .ics-Datei hier hoch.</li>
              </ol>
              <p className="mt-2">
                <b>Alternativ über URL:</b> Klicke auf den Kalender → <b>Kalender freigeben</b> → URL kopieren → URL im Browser einfügen → <code>webcal://</code> am Anfang zu <code>https://</code> ändern → die .ics-Datei wird heruntergeladen.
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="font-medium text-foreground mb-1">Google Kalender</div>
              <ol className="space-y-1 pl-4 list-decimal">
                <li>Öffne Google Kalender im Browser.</li>
                <li>Gehe oben rechts auf das <b>Zahnrad → Einstellungen</b>.</li>
                <li>Klicke links auf <b>Importieren &amp; Exportieren</b>.</li>
                <li>Klicke auf <b>Exportieren</b> – eine .zip-Datei wird heruntergeladen.</li>
                <li>Öffne die .zip-Datei – darin befindet sich eine .ics-Datei.</li>
                <li>Lade diese .ics-Datei hier hoch.</li>
              </ol>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
