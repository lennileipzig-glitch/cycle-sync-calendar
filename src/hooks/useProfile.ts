import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isGuest, guestStore } from "@/lib/guestStore";

export type DietStyle = "omnivore" | "vegetarian" | "vegan" | "pescetarian";
export type SportLevel = "beginner" | "regular" | "athletic";

export interface Profile {
  id: string;
  display_name: string | null;
  avg_cycle_length: number;
  avg_period_length: number;
  last_period_start: string | null;
  onboarding_completed: boolean;
  in_menopause: boolean;
  // Ernährung
  diet_style: DietStyle;
  diet_intolerances: string[];
  favorite_foods: string[];
  // Sport
  sports: string[];
  sport_level: SportLevel;
  sport_frequency_per_week: number;
  // Notifications (nur UI-Vorbereitung, kein Versand)
  notifications_enabled: boolean;
  notification_time: string; // "HH:MM"
  notification_topics: string[];
  // Eigene gespeicherte Beschwerden
  custom_symptoms: string[];
}

const guestId = "guest-local";

export function useProfile(userId: string | undefined, isGuestMode: boolean) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    if (isGuestMode) {
      const g = guestStore.getProfile();
      setProfile({ id: guestId, ...g });
      setLoading(false);
      return;
    }
    if (!userId) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, [userId, isGuestMode]);

  useEffect(() => { reload(); }, [reload]);

  const update = async (patch: Partial<Profile>) => {
    if (isGuest()) {
      const updated = guestStore.updateProfile(patch);
      setProfile({ id: guestId, ...updated });
      return;
    }
    if (!userId) return;
    const { data } = await supabase.from("profiles").update(patch).eq("id", userId).select().single();
    if (data) setProfile(data as Profile);
  };

  return { profile, loading, update, reload };
}
