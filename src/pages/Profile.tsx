import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LogOut, Upload, Calendar as CalendarIcon, TrendingUp, Settings as SettingsIcon, Apple, Dumbbell, Bell, User as UserIcon, Save, Globe, Shield, Trash2, CreditCard, Star, ExternalLink } from "lucide-react";
import { SUPPORTED_LANGUAGES, type LangCode } from "@/i18n";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type DietStyle, type SportLevel } from "@/hooks/useProfile";
import { isGuest, guestStore } from "@/lib/guestStore";
import { dataApi } from "@/lib/dataApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ImportDialog } from "@/components/ImportDialog";
import { EnergyChart } from "@/components/profile/EnergyChart";
import { TagInput } from "@/components/profile/TagInput";

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
const NOTIFICATION_TOPIC_OPTIONS = [
  { id: "energy_forecast", label: "Energie-Forecast", desc: "z. B. „Deine Energie steigt heute wahrscheinlich – guter Tag für schwierige Gespräche.“" },
  { id: "checkin", label: "Sanftes Check-in", desc: "z. B. „Wie geht's dir heute?“" },
  { id: "phase_change", label: "Phasenwechsel", desc: "Hinweise, wenn du in eine neue Zyklusphase wechselst." },
  { id: "appointment_prep", label: "Termin-Kontext", desc: "Energie-Hinweis vor anstehenden Terminen." },
];

export default function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, guestMode } = useAuth();
  const guest = guestMode || isGuest();
  const userId = user?.id ?? null;
  const { profile, update, loading } = useProfile(user?.id, guest);

  const [importKind, setImportKind] = useState<"csv" | "ics" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rated, setRated] = useState(false);

  // Lokale Form-States
  const [name, setName] = useState("");
  const [meno, setMeno] = useState(false);
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen, setPeriodLen] = useState(5);
  const [lastPeriod, setLastPeriod] = useState("");
  const [dietStyle, setDietStyle] = useState<DietStyle>("omnivore");
  const [intolerances, setIntolerances] = useState<string[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [sportLevel, setSportLevel] = useState<SportLevel>("regular");
  const [sportFreq, setSportFreq] = useState(3);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState("09:00");
  const [notifTopics, setNotifTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setMeno(profile.in_menopause);
    setCycleLen(profile.avg_cycle_length);
    setPeriodLen(profile.avg_period_length);
    setLastPeriod(profile.last_period_start ?? "");
    setDietStyle(profile.diet_style);
    setIntolerances(profile.diet_intolerances);
    setFavoriteFoods(profile.favorite_foods);
    setSports(profile.sports);
    setSportLevel(profile.sport_level);
    setSportFreq(profile.sport_frequency_per_week);
    setNotifEnabled(profile.notifications_enabled);
    setNotifTime(profile.notification_time?.slice(0, 5) ?? "09:00");
    setNotifTopics(profile.notification_topics);
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
      avg_cycle_length: cycleLen,
      avg_period_length: periodLen,
      last_period_start: meno ? null : (lastPeriod || null),
    });
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
  const saveNotifications = async () => {
    await update({ notifications_enabled: notifEnabled, notification_time: notifTime, notification_topics: notifTopics });
    toast.success("Benachrichtigungen gespeichert");
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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (guest) {
        guestStore.clearAll();
        toast.success(t("settings.delete_success"));
        navigate("/auth", { replace: true });
        window.location.reload();
        return;
      }
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success(t("settings.delete_success"));
      navigate("/auth", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error(t("settings.delete_error"));
    } finally {
      setDeleting(false);
    }
  };

  const changeLanguage = (lng: LangCode) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("luna-lang", lng);
  };

  const toggleTopic = (id: string) => {
    setNotifTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
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
          <Button variant="ghost" size="icon" onClick={handleSignOut} title={guest ? t("app.guest_clear") : t("app.sign_out")}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl py-6">
        <Tabs defaultValue="energy" className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="energy"><TrendingUp className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.energy")}</span></TabsTrigger>
            <TabsTrigger value="basics"><UserIcon className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.cycle")}</span></TabsTrigger>
            <TabsTrigger value="diet"><Apple className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.diet")}</span></TabsTrigger>
            <TabsTrigger value="sport"><Dumbbell className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.sport")}</span></TabsTrigger>
            <TabsTrigger value="notifs"><Bell className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.notifs")}</span></TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t("tabs.settings")}</span></TabsTrigger>
          </TabsList>

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

          {/* ZYKLUS / STAMMDATEN */}
          <TabsContent value="basics">
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Stammdaten & Zyklus</h2>
                <p className="text-sm text-muted-foreground">Diese Werte helfen Luna, deine Phasen zu berechnen.</p>
              </div>

              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Wie sollen wir dich nennen?" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Ich bin in der Menopause</div>
                  <div className="text-xs text-muted-foreground">Luna fokussiert auf Energie & Wohlbefinden statt Zyklusphase.</div>
                </div>
                <Switch checked={meno} onCheckedChange={setMeno} />
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

              <div className="pt-2 border-t border-border space-y-2">
                <Label>Daten importieren</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="justify-start" onClick={() => setImportKind("csv")}>
                    <Upload className="h-4 w-4 mr-2" /> Zyklus-CSV
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => setImportKind("ics")}>
                    <CalendarIcon className="h-4 w-4 mr-2" /> Kalender (.ics)
                  </Button>
                </div>
              </div>

              <Button onClick={saveProfileBasics} className="w-full"><Save className="h-4 w-4 mr-2" /> Speichern</Button>
            </Card>
          </TabsContent>

          {/* ERNÄHRUNG */}
          <TabsContent value="diet">
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Ernährungseinstellungen</h2>
                <p className="text-sm text-muted-foreground">Damit Luna passende Lebensmittel für deine Phase vorschlägt.</p>
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
                <p className="text-sm text-muted-foreground">Damit Luna Bewegungstipps vorschlägt, die zu dir passen.</p>
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

          {/* NOTIFICATIONS */}
          <TabsContent value="notifs">
            <Card className="p-5 space-y-5">
              <div>
                <h2 className="text-lg">Benachrichtigungen</h2>
                <p className="text-sm text-muted-foreground">
                  Wir bereiten Push-Notifications vor, die dir wirklich helfen – nicht nur Erinnerungen, sondern Hinweise mit Mehrwert.
                  Aktuell speichern wir nur deine Vorlieben; der Versand kommt im nächsten Schritt.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Benachrichtigungen aktivieren</div>
                  <div className="text-xs text-muted-foreground">Du kannst es jederzeit wieder ausschalten.</div>
                </div>
                <Switch checked={notifEnabled} onCheckedChange={setNotifEnabled} />
              </div>

              <div className="space-y-2">
                <Label>Bevorzugte Uhrzeit</Label>
                <Input type="time" value={notifTime} onChange={e => setNotifTime(e.target.value)} disabled={!notifEnabled} />
              </div>

              <div className="space-y-2">
                <Label>Themen</Label>
                <div className="space-y-2">
                  {NOTIFICATION_TOPIC_OPTIONS.map(t => (
                    <label key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition">
                      <Checkbox
                        checked={notifTopics.includes(t.id)}
                        onCheckedChange={() => toggleTopic(t.id)}
                        disabled={!notifEnabled}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={saveNotifications} className="w-full"><Save className="h-4 w-4 mr-2" /> Speichern</Button>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            <div className="space-y-4">
              {/* Sprache */}
              <Card className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <h2 className="text-lg">{t("settings.language")}</h2>
                    <p className="text-sm text-muted-foreground">{t("settings.language_desc")}</p>
                  </div>
                </div>
                <Select value={i18n.language?.split("-")[0] ?? "de"} onValueChange={(v) => changeLanguage(v as LangCode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              {/* Datenschutz */}
              <Card className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <h2 className="text-lg">{t("settings.privacy")}</h2>
                    <p className="text-sm text-muted-foreground">{t("settings.privacy_body")}</p>
                  </div>
                </div>
                <Button
                  variant="link"
                  className="p-0 h-auto justify-start"
                  onClick={() => window.open("/privacy", "_blank")}
                >
                  {t("settings.privacy_link")} <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Card>

              {/* Konto */}
              <Card className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <UserIcon className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <h2 className="text-lg">{t("settings.account")}</h2>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{guest ? t("app.guest_clear") : t("app.sign_out")}</div>
                    <div className="text-xs text-muted-foreground">{t("settings.sign_out_desc")}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" /> {guest ? t("app.guest_clear") : t("app.sign_out")}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-destructive">{t("settings.delete_profile")}</div>
                    <div className="text-xs text-muted-foreground">
                      {guest ? t("settings.guest_delete_desc") : t("settings.delete_profile_desc")}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deleting}>
                        <Trash2 className="h-4 w-4 mr-2" /> {t("settings.delete_profile")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("settings.delete_confirm_title")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("settings.delete_confirm_body")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("settings.delete_cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("settings.delete_confirm_action")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>

              {/* Zahlung */}
              <Card className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <h2 className="text-lg">{t("settings.payments")}</h2>
                    <p className="text-sm text-muted-foreground">{t("settings.payments_body")}</p>
                  </div>
                </div>
                <Button variant="outline" disabled className="w-full">
                  {t("settings.payments_cta")} · {t("settings.payments_soon")}
                </Button>
              </Card>

              {/* App bewerten */}
              <Card className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <h2 className="text-lg">{t("settings.rate")}</h2>
                    <p className="text-sm text-muted-foreground">{t("settings.rate_body")}</p>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => { setRated(true); toast.success(t("settings.rate_thanks")); }}
                  disabled={rated}
                >
                  <Star className="h-4 w-4 mr-2" /> {rated ? t("settings.rate_thanks") : t("settings.rate_cta")}
                </Button>
              </Card>
            </div>
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
    </div>
  );
}
