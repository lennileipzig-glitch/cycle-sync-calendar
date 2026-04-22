import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, LogOut, Save, Globe, Shield, Trash2, CreditCard, Star, ExternalLink,
  Bell, User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { isGuest, guestStore } from "@/lib/guestStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SUPPORTED_LANGUAGES, type LangCode } from "@/i18n";

const NOTIFICATION_TOPIC_OPTIONS = [
  { id: "energy_forecast", label: "Energie-Forecast", desc: "z. B. „Deine Energie steigt heute wahrscheinlich – guter Tag für schwierige Gespräche.“" },
  { id: "checkin", label: "Sanftes Check-in", desc: "z. B. „Wie geht's dir heute?“" },
  { id: "phase_change", label: "Phasenwechsel", desc: "Hinweise, wenn du in eine neue Zyklusphase wechselst." },
  { id: "appointment_prep", label: "Termin-Kontext", desc: "Energie-Hinweis vor anstehenden Terminen." },
];

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, guestMode } = useAuth();
  const guest = guestMode || isGuest();
  const { profile, update, loading } = useProfile(user?.id, guest);

  const [deleting, setDeleting] = useState(false);
  const [rated, setRated] = useState(false);

  // Notification form state
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState("09:00");
  const [notifTopics, setNotifTopics] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
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

  const saveNotifications = async () => {
    await update({
      notifications_enabled: notifEnabled,
      notification_time: notifTime,
      notification_topics: notifTopics,
    });
    toast.success(t("app.saved"));
  };

  const toggleTopic = (id: string) => {
    setNotifTopics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const changeLanguage = (lng: LangCode) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("luna-lang", lng);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-4xl flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={t("app.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl">{t("settings.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("settings.subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 space-y-4">
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

        {/* Benachrichtigungen */}
        <Card className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 mt-0.5 text-primary" />
            <div className="flex-1">
              <h2 className="text-lg">Benachrichtigungen</h2>
              <p className="text-sm text-muted-foreground">
                Push-Notifications mit Mehrwert – nicht „vergiss nicht zu tracken“,
                sondern „Deine Energie steigt heute wahrscheinlich“.
              </p>
            </div>
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
              {NOTIFICATION_TOPIC_OPTIONS.map(topic => (
                <label key={topic.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition">
                  <Checkbox
                    checked={notifTopics.includes(topic.id)}
                    onCheckedChange={() => toggleTopic(topic.id)}
                    disabled={!notifEnabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{topic.label}</div>
                    <div className="text-xs text-muted-foreground">{topic.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={saveNotifications} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {t("app.save")}
          </Button>
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
          <Button variant="link" className="p-0 h-auto justify-start" onClick={() => window.open("/privacy", "_blank")}>
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
      </main>
    </div>
  );
}
