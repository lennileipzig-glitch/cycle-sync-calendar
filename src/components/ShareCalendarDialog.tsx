import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Link2, Copy, Trash2, ShieldAlert, CalendarDays, ExternalLink } from "lucide-react";
import { sharingApi, buildShareLink, buildICalUrl, buildWebcalUrl, type CalendarShare } from "@/lib/sharingApi";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  ownerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ShareCalendarDialog({ ownerId, open, onOpenChange }: Props) {
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [email, setEmail] = useState("");
  const [showPhases, setShowPhases] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"email" | "link">("email");

  const reload = async () => {
    if (!ownerId) return;
    try {
      const list = await sharingApi.getMyShares(ownerId);
      setShares(list);
    } catch {
      toast.error("Freigaben konnten nicht geladen werden");
    }
  };

  useEffect(() => {
    if (open) {
      setEmail("");
      setShowPhases(false);
      setTab("email");
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId]);

  const handleCreate = async () => {
    if (!ownerId) return;
    if (tab === "email" && !email.trim()) {
      toast.error("Bitte E-Mail angeben");
      return;
    }
    setCreating(true);
    try {
      const share = await sharingApi.createShare(ownerId, {
        recipientEmail: tab === "email" ? email : undefined,
        showPhases,
        method: tab,
      });
      toast.success(tab === "email" ? "Einladung erstellt" : "Link erstellt");
      setEmail("");
      await reload();
      if (tab === "link") {
        await navigator.clipboard.writeText(buildShareLink(share.invite_token));
        toast.success("Link in die Zwischenablage kopiert");
      }
    } catch (e) {
      console.error(e);
      toast.error("Konnte Freigabe nicht erstellen");
    } finally {
      setCreating(false);
    }
  };

  const togglePhases = async (id: string, value: boolean) => {
    try {
      await sharingApi.updateShare(id, { show_phases: value });
      setShares(s => s.map(x => x.id === id ? { ...x, show_phases: value } : x));
    } catch {
      toast.error("Update fehlgeschlagen");
    }
  };

  const remove = async (id: string) => {
    try {
      await sharingApi.deleteShare(id);
      setShares(s => s.filter(x => x.id !== id));
      toast.success("Freigabe entfernt");
    } catch {
      toast.error("Löschen fehlgeschlagen");
    }
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildShareLink(token));
    toast.success("Link kopiert");
  };

  const copyICal = async (token: string) => {
    await navigator.clipboard.writeText(buildICalUrl(token));
    toast.success("iCal-Link kopiert – in Apple/Google Kalender als Abo einfügen");
  };

  const openInExternal = (token: string) => {
    window.location.href = buildWebcalUrl(token);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kalender teilen</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-border/60 p-3 flex items-start justify-between gap-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="cursor-pointer">Zyklusphasen mit anzeigen</Label>
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Standard: aus. Eingeladene Personen sehen nur Termine (Titel + Zeit), keine Tracker-Daten.
              </p>
            </div>
            <Switch checked={showPhases} onCheckedChange={setShowPhases} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "email" | "link")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-2" />Per E-Mail</TabsTrigger>
              <TabsTrigger value="link"><Link2 className="h-4 w-4 mr-2" />Per Link</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label htmlFor="share-email">E-Mail-Adresse</Label>
                <Input
                  id="share-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="kollegin@beispiel.de"
                />
                <p className="text-xs text-muted-foreground">
                  Hat die Person ein Luna-Konto mit dieser E-Mail, erscheint dein Kalender automatisch.
                </p>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Speichere…" : "Einladen"}
              </Button>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                Erstelle einen Link, den du verschicken kannst. Wer ihn öffnet und in Luna eingeloggt ist, kann den Kalender abonnieren.
              </p>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? "Erstelle…" : "Einladungs-Link erzeugen"}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 pt-2 border-t border-border/60">
            <h4 className="text-sm font-medium">Aktive Freigaben</h4>
            {shares.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Noch keine Freigaben.</p>
            ) : (
              <ul className="space-y-2">
                {shares.map(s => (
                  <li key={s.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {s.invite_method === "email"
                            ? <><Mail className="h-3.5 w-3.5 shrink-0" /> {s.recipient_email}</>
                            : <><Link2 className="h-3.5 w-3.5 shrink-0" /> Link-Einladung</>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {s.status === "accepted" ? "angenommen" : s.status === "pending" ? "ausstehend" : "widerrufen"}
                          {" · "}seit {format(new Date(s.created_at), "d. MMM yyyy", { locale: de })}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(s.id)} aria-label="Entfernen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Label htmlFor={`phases-${s.id}`} className="text-xs cursor-pointer">Phasen sichtbar</Label>
                      <Switch id={`phases-${s.id}`} checked={s.show_phases} onCheckedChange={(v) => togglePhases(s.id, v)} />
                    </div>
                    {s.invite_method === "link" && s.status !== "revoked" && (
                      <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => copyLink(s.invite_token)}>
                        <Copy className="h-3 w-3 mr-1" /> Luna-Link kopieren
                      </Button>
                    )}
                    {s.status !== "revoked" && (
                      <div className="rounded-md border border-border/60 bg-background/50 p-2 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          Apple / Google Kalender abonnieren
                        </div>
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => copyICal(s.invite_token)}>
                            <Copy className="h-3 w-3 mr-1" /> iCal-Link
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => openInExternal(s.invite_token)}>
                            <ExternalLink className="h-3 w-3 mr-1" /> Öffnen
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
