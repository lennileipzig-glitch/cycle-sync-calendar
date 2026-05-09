import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Upload, Calendar as CalendarIcon, TrendingUp, Settings as SettingsIcon, Apple, Dumbbell, User as UserIcon, Save, Share2, Mail, Lock, Crown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type DietStyle, type SportLevel, type EndometriosisStatus } from "@/hooks/useProfile";
import { isGuest } from "@/lib/guestStore";
import { dataApi } from "@/lib/dataApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ImportDialog } from "@/components/ImportDialog";
import { EnergyChart } from "@/components/profile/EnergyChart";
import { TagInput } from "@/components/profile/TagInput";
import { ShareCalendarDialog } from "@/components/ShareCalendarDialog";

const DIET_STYLES: { value: DietStyle; label: string }[] = [
  { value: "omnivore", label: "Omnivor (alles)" },
  { value: "pescetarian", label: "Pescetarisch" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
];
const COMMON_INTOLERANCES = ["Laktose", "Gluten", "Fructose", "Histamin", "Nüsse", "Soja", "Ei"];
const COMMON_SPORTS = ["Yoga", "Laufen", "Krafttraining", "Schwimmen", "Radfahren", "Pilates", "Tanz", "Wandern"];
const SPORT_LEVELS: { value: SportLevel; label: string }[] = [
  { value: "beginner", label: "Einsteigerin" },
  { value: "regular", label: "Regelmäßig" },
  { value: "athletic", label: "Sportlich" },
];

export default function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading, guestMode } = useAuth();
  const guest = guestMode || isGuest();
  const userId = user?.id ?? null;
  const { profile, update, loading } = useProfile(user?.id, guest);

  const [importKind, setImportKind] = useState<"ics" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Lokale Form-States
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [meno, setMeno] = useState(false);
  const [endoStatus, setEndoStatus] = useState<EndometriosisStatus>("none");
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen, setPeriodLen] = useState(5);
  const [lastPeriod, setLastPeriod] = useState("");
  const [dietStyle, setDietStyle] = useState<DietStyle>("omnivore");
  const [intolerances, setIntolerances] = useState<string[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [sportLevel, setSportLevel] = useState<SportLevel>("regular");
  const [sportFreq, setSportFreq] = useState(3);

  // Account
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const userEmail = user?.email ?? (guest ? "Gastmodus (keine E-Mail)" : "");
  const subscriptionPlan = "Free"; // Platzhalter bis Abo-System implementiert ist

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setMeno(profile.in_menopause);
    setEndoStatus(profile.endometriosis_status ?? "none");
    setCycleLen(profile.avg_cycle_length);
    setPeriodLen(profile.avg_period_length);
    setLastPeriod(profile.last_period_start ?? "");
    setDietStyle(profile.diet_style);
    setIntolerances(profile.diet_intolerances);
    setFavoriteFoods(profile.favorite_foods);
    setSports(profile.sports);
    setSportLevel(profile.sport_level);
    setSportFreq(profile.sport_frequency_per_week);
    // Alter aus localStorage (noch nicht im DB-Schema)
    const storedAge = localStorage.getItem(`fravia-age-${profile.id}`);
    if (storedAge) setAge(storedAge);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user && !guest) navigate("/auth", { replace: true });
  }, [authLoading, user, guest, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("app.loading_profile")}</div>;
  }

  const saveProfileBasics = async () => {
    await update({
      display_name: name || null,
      in_menopause: meno,
      endometriosis_status: endoStatus,
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      last_period_start: meno ? null : (lastPeriod || null),
    });
    if (profile) {
      if (age) localStorage.setItem(`fravia-age-${profile.id}`, age);
      else localStorage.removeItem(`fravia-age-${profile.id}`);
    }
    toast.success("Profil gespeichert");
  };
  const saveDiet = async () => {
    await update({ diet_style: dietStyle, diet_intolerances: intolerances, favorite_foods: favoriteFoods });
    toast.success("Ernährung gespeichert");
  };
  const saveSports = async () => {
    await update({ sports, sport_level: sportLevel, sport_frequency_per_week: sportFreq });
    toast.success("Sport gespeichert");
  };
  const changePassword = async () => {
    if (guest) { toast.error("Im Gastmodus nicht verfügbar"); return; }
    if (newPassword.length < 6) { toast.error("Passwort muss mindestens 6 Zeichen haben"); return; }
    if (newPassword !== newPassword2) { toast.error("Passwörter stimmen nicht überein"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);
    if (error) { toast.error(error.message); return; }
    setNewPassword(""); setNewPassword2("");
    toast.success("Passwort geändert");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-4xl flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={t("app.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl">{t("app.profile")}</h1>
              <p className="text-xs text-muted-foreground">{profile.display_name ?? t("app.greeting_default")}{guest && ` · ${t("app.guest_mode")}`}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} title={t("settings.title")} aria-label={t("settings.title")}>
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl py-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="profile"><UserIcon className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Profil</span></TabsTrigger>
            <TabsTrigger value="energy"><TrendingUp className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.energy")}</span></TabsTrigger>
            <TabsTrigger value="diet"><Apple className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.diet")}</span></TabsTrigger>
            <TabsTrigger value="sport"><Dumbbell className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.sport")}</span></TabsTrigger>
          </TabsList>

          {/* PROFIL (vereint Stammdaten, Zyklus, Account, Abo, Import, Teilen) */}
          <TabsContent value="profile" className="space-y-6">
            {/* Persönliche Daten */}
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Persönliche Daten</h2>
                <p className="text-sm text-muted-foreground">So sprechen wir dich an und so berechnen wir deine Phasen.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Wie sollen wir dich nennen?" />
                </div>
                <div className="space-y-2">
                  <Label>Alter</Label>
                  <Input type="number" min={10} max={120} value={age} onChange={e => setAge(e.target.value)} placeholder="z. B. 32" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Ich bin in der Menopause</div>
                  <div className="text-xs text-muted-foreground">Fravia fokussiert auf Energie & Wohlbefinden statt Zyklusphase.</div>
                </div>
                <Switch checked={meno} onCheckedChange={setMeno} />
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">Endometriose</strong> ist eine chronische Erkrankung, bei der gebärmutterschleimhautähnliches Gewebe außerhalb der Gebärmutter wächst. Häufige Anzeichen: starke Regelschmerzen, Schmerzen im Becken, Erschöpfung. Fravia berücksichtigt das in ihren Empfehlungen.
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="pr-3">
                    <div className="text-sm font-medium">Ich habe diagnostizierte Endometriose</div>
                    <div className="text-xs text-muted-foreground">Ärztlich bestätigt (z. B. per Laparoskopie).</div>
                  </div>
                  <Switch
                    checked={endoStatus === "diagnosed"}
                    onCheckedChange={(v) => setEndoStatus(v ? "diagnosed" : "none")}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="pr-3">
                    <div className="text-sm font-medium">Bei mir ist Verdacht auf Endometriose</div>
                    <div className="text-xs text-muted-foreground">Symptome passen, aber noch keine gesicherte Diagnose.</div>
                  </div>
                  <Switch
                    checked={endoStatus === "suspected"}
                    onCheckedChange={(v) => setEndoStatus(v ? "suspected" : "none")}
                  />
                </div>
              </div>

              {!meno && (
                <>
                  <div className="space-y-2">
                    <Label>Letzter Periodenstart</Label>
                    <Input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Zykluslänge (Tage)</Label>
                      <Input type="number" min={20} max={45} value={cycleLen} onChange={e => setCycleLen(+e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Periodendauer</Label>
                      <Input type="number" min={2} max={10} value={periodLen} onChange={e => setPeriodLen(+e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={saveProfileBasics} className="w-full"><Save className="h-4 w-4 mr-2" /> Speichern</Button>
            </Card>

            {/* Account */}
            {!guest && (
              <Card className="p-5 space-y-5">
                <div>
                  <h2 className="text-lg">Account</h2>
                  <p className="text-sm text-muted-foreground">Deine Anmeldedaten.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-Mail-Adresse</Label>
                  <Input value={userEmail} disabled />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Passwort</Label>
                  <Input value="••••••••••" disabled />
                </div>

                <div className="pt-3 border-t border-border space-y-3">
                  <Label>Passwort ändern</Label>
                  <PasswordInput placeholder="Neues Passwort" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <PasswordInput placeholder="Neues Passwort wiederholen" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} />
                  <Button onClick={changePassword} disabled={savingPwd} className="w-full">
                    <Lock className="h-4 w-4 mr-2" /> {savingPwd ? "Wird geändert…" : "Passwort ändern"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Abo-Modell */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg flex items-center gap-2"><Crown className="h-5 w-5" /> Abo-Modell</h2>
                  <p className="text-sm text-muted-foreground">Dein aktueller Plan.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-secondary text-sm font-medium">{subscriptionPlan}</span>
              </div>
            </Card>

            {/* Daten importieren */}
            <Card className="p-5 space-y-3">
              <div>
                <h2 className="text-lg">Daten importieren</h2>
                <p className="text-sm text-muted-foreground">Übernimm Termine aus deinem bisherigen Kalender.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Kein Import nötig – gib einfach deinen letzten Periodenstart und deine Zykluslänge ein. Fravia lernt mit der Zeit.
              </div>
              <Button variant="outline" className="w-full justify-start" onClick={() => setImportKind("ics")}>
                <CalendarIcon className="h-4 w-4 mr-2" /> Kalender (.ics aus Google/Apple)
              </Button>
            </Card>

            {/* Kalender teilen */}
            {!guest && (
              <Card className="p-5 space-y-3">
                <div>
                  <h2 className="text-lg">Kalender teilen</h2>
                  <p className="text-sm text-muted-foreground">Lade Personen ein, deinen Kalender zu sehen. Du entscheidest pro Person, ob deine Zyklusphasen sichtbar sind (Standard: aus).</p>
                </div>
                <Button variant="outline" className="w-full justify-start" onClick={() => setShareOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" /> Freigaben verwalten
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* ENERGIEKURVE */}
          <TabsContent value="energy">
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="text-lg">Deine Energiekurve</h2>
                <p className="text-sm text-muted-foreground">
                  Sieh, wie deine Energie sich über die Zeit entwickelt. Wechsle zwischen Tag, Woche, Monat und Jahr – und klicke einen Punkt für die Tagesdetails.
                </p>
              </div>
              <EnergyChart userId={userId} />
            </Card>
          </TabsContent>
          {/* ERNÄHRUNG */}
          <TabsContent value="diet">
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Ernährungseinstellungen</h2>
                <p className="text-sm text-muted-foreground">Damit Fravia passende Lebensmittel für deine Phase vorschlägt.</p>
              </div>

              <div className="space-y-2">
                <Label>Ernährungsstil</Label>
                <Select value={dietStyle} onValueChange={(v: DietStyle) => setDietStyle(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIET_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unverträglichkeiten / Allergien</Label>
                <TagInput values={intolerances} onChange={setIntolerances} placeholder="Eigene hinzufügen..." suggestions={COMMON_INTOLERANCES} />
              </div>

              <div className="space-y-2">
                <Label>Lieblingslebensmittel</Label>
                <TagInput values={favoriteFoods} onChange={setFavoriteFoods} placeholder="z. B. Avocado, Haferflocken, Lachs..." />
              </div>

              <Button onClick={saveDiet} className="w-full"><Save className="h-4 w-4 mr-2" /> Speichern</Button>
            </Card>
          </TabsContent>

          {/* SPORT */}
          <TabsContent value="sport">
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Sporteinstellungen</h2>
                <p className="text-sm text-muted-foreground">Damit Fravia Bewegungstipps vorschlägt, die zu dir passen.</p>
              </div>

              <div className="space-y-2">
                <Label>Sportarten, die du machst</Label>
                <TagInput values={sports} onChange={setSports} placeholder="Eigene Sportart..." suggestions={COMMON_SPORTS} />
              </div>

              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={sportLevel} onValueChange={(v: SportLevel) => setSportLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPORT_LEVELS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <Label>Trainings pro Woche</Label>
                  <span className="text-sm font-medium">{sportFreq}×</span>
                </div>
                <Slider value={[sportFreq]} min={1} max={7} step={1} onValueChange={(v) => setSportFreq(v[0])} />
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>1×</span><span>2×</span><span>3×</span><span>4×</span><span>5×</span><span>6×</span><span>7×</span>
                </div>
              </div>

              <Button onClick={saveSports} className="w-full"><Save className="h-4 w-4 mr-2" /> Speichern</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <ImportDialog
        kind={importKind}
        onOpenChange={(o) => !o && setImportKind(null)}
        onImportLogs={async (logs, earliestPeriodStart) => {
          await dataApi.bulkInsertLogs(userId, logs);
          if (earliestPeriodStart && !profile.last_period_start) {
            await update({ last_period_start: earliestPeriodStart });
          }
          toast.success(`${logs.length} Einträge importiert`);
        }}
        onImportEvents={async (events) => {
          await dataApi.addEvents(userId, events.map(e => ({ ...e, source: "ics-import" })));
          toast.success(`${events.length} Termine importiert`);
        }}
      />

      <ShareCalendarDialog ownerId={userId} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
