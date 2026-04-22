import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseCycleCSV } from "@/lib/csvImport";
import { parseICS } from "@/lib/icsParser";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  kind: "csv" | "ics" | null;
  onOpenChange: (open: boolean) => void;
  onImportLogs?: (logs: { log_date: string; mood: string | null; energy_level: string | null; symptoms: string[]; notes: string | null }[], earliestPeriodStart: string | null) => Promise<void> | void;
  onImportEvents?: (events: { title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null }[]) => Promise<void> | void;
}

export function ImportDialog({ kind, onOpenChange, onImportLogs, onImportEvents }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string>("");

  const isCSV = kind === "csv";
  const open = kind !== null;

  const handleFile = async (file: File) => {
    setBusy(true);
    setPreview("");
    try {
      const text = await file.text();
      if (isCSV) {
        const { logs, earliestPeriodStart, totalRows } = parseCycleCSV(text);
        if (totalRows === 0) throw new Error("Keine gültigen Zeilen gefunden.");
        await onImportLogs?.(logs.map(({ is_period_start, ...l }) => l), earliestPeriodStart);
        setPreview(`${totalRows} Tage importiert${earliestPeriodStart ? ` · letzte Periode: ${earliestPeriodStart}` : ""}.`);
        toast.success(`${totalRows} Tage importiert`);
      } else {
        const events = parseICS(text);
        if (events.length === 0) throw new Error("Keine Termine in der Datei gefunden.");
        await onImportEvents?.(events.map(({ external_uid, ...e }) => e));
        setPreview(`${events.length} Termine importiert.`);
        toast.success(`${events.length} Termine importiert`);
      }
      setTimeout(() => onOpenChange(false), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCSV ? "Zyklusdaten importieren" : "Kalender importieren"}</DialogTitle>
          <DialogDescription>
            {isCSV
              ? "Lade eine CSV aus Clue, Flo, Apple Health o.ä. hoch. Erkannte Spalten: date, period, mood, energy, symptoms, notes."
              : "Exportiere deinen Kalender als .ics-Datei aus Google Calendar oder Apple Kalender und lade sie hier hoch."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <input
            ref={fileRef}
            type="file"
            accept={isCSV ? ".csv,text/csv" : ".ics,text/calendar"}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full" size="lg">
            <Upload className="h-4 w-4 mr-2" /> {busy ? "Importiere..." : "Datei auswählen"}
          </Button>
          {preview && <p className="text-sm text-center text-muted-foreground">{preview}</p>}
          {isCSV && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Wie exportiere ich aus meiner App?</summary>
              <ul className="mt-2 space-y-1 pl-4 list-disc">
                <li><b>Clue:</b> Einstellungen → Datenexport → CSV.</li>
                <li><b>Flo:</b> Profil → Daten → Daten exportieren.</li>
                <li><b>Apple Health:</b> Profil → Alle Daten exportieren (.zip enthält Zyklus-CSV).</li>
              </ul>
            </details>
          )}
          {!isCSV && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Wie exportiere ich meinen Kalender?</summary>
              <ul className="mt-2 space-y-1 pl-4 list-disc">
                <li><b>Google Calendar:</b> Einstellungen → Kalender importieren/exportieren → Exportieren (.ics).</li>
                <li><b>Apple Kalender:</b> Datei → Exportieren → Kalender exportieren.</li>
              </ul>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
