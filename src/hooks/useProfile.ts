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

  const fetchProfile = useCallback(async () => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("profile fetch error", error, { userId });
      throw error;
    }

    if (data) return data as Profile;

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (createError) {
      console.error("profile bootstrap error", createError, { userId });
      throw createError;
    }

    return (created as Profile | null) ?? null;
  }, [userId]);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      if (isGuestMode) {
        const g = guestStore.getProfile();
        setProfile({ id: guestId, ...g });
        return;
      }

      if (!userId) {
        setProfile(null);
        return;
      }

      const nextProfile = await fetchProfile();
      setProfile(nextProfile);
    } catch (error) {
      console.error("profile reload failed", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, isGuestMode, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = async (patch: Partial<Profile>) => {
    if (isGuest()) {
      const updated = guestStore.updateProfile(patch);
      setProfile({ id: guestId, ...updated });
      return;
    }

    if (!userId) return;

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...patch }, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (error) {
      console.error("profile update error", error, patch);
      throw error;
    }

    if (data) {
      setProfile(data as Profile);
      return;
    }

    const fresh = await fetchProfile();
    if (fresh) {
      setProfile(fresh);
      return;
    }

    throw new Error("Profil konnte nach dem Speichern nicht geladen werden.");
  };

  return { profile, loading, update, reload };
}
