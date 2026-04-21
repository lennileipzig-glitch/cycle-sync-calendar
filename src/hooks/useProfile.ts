import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  display_name: string | null;
  avg_cycle_length: number;
  avg_period_length: number;
  last_period_start: string | null;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, [userId]);

  const update = async (patch: Partial<Profile>) => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").update(patch).eq("id", userId).select().single();
    if (data) setProfile(data as Profile);
  };

  return { profile, loading, update };
}
