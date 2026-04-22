// Kalender-Sharing API
import { supabase } from "@/integrations/supabase/client";

export interface CalendarShare {
  id: string;
  owner_id: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  show_phases: boolean;
  invite_token: string;
  invite_method: "email" | "link";
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  accepted_at: string | null;
}

export const sharingApi = {
  // Freigaben, die ICH erstellt habe
  async getMyShares(ownerId: string): Promise<CalendarShare[]> {
    const { data, error } = await supabase
      .from("calendar_shares")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CalendarShare[];
  },

  // Freigaben, die FÜR MICH erstellt wurden (nach E-Mail oder User-ID)
  async getSharedWithMe(): Promise<CalendarShare[]> {
    const { data, error } = await supabase
      .from("calendar_shares")
      .select("*")
      .eq("status", "accepted");
    if (error) throw error;
    return (data ?? []) as CalendarShare[];
  },

  async createShare(
    ownerId: string,
    opts: { recipientEmail?: string; showPhases: boolean; method: "email" | "link" },
  ): Promise<CalendarShare> {
    const { data, error } = await supabase
      .from("calendar_shares")
      .insert({
        owner_id: ownerId,
        recipient_email: opts.recipientEmail?.trim().toLowerCase() || null,
        show_phases: opts.showPhases,
        invite_method: opts.method,
        // Wenn per E-Mail an einen bekannten Fravia-Nutzer geschickt wird,
        // setzen wir ihn direkt auf accepted, sodass er sofort erscheint.
        // Anders bei Link → bleibt pending bis zur Annahme.
        status: opts.method === "email" && opts.recipientEmail ? "accepted" : "pending",
        accepted_at: opts.method === "email" && opts.recipientEmail ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as CalendarShare;
  },

  async revokeShare(id: string): Promise<void> {
    const { error } = await supabase
      .from("calendar_shares")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteShare(id: string): Promise<void> {
    const { error } = await supabase.from("calendar_shares").delete().eq("id", id);
    if (error) throw error;
  },

  async updateShare(id: string, patch: Partial<Pick<CalendarShare, "show_phases">>): Promise<void> {
    const { error } = await supabase.from("calendar_shares").update(patch).eq("id", id);
    if (error) throw error;
  },

  // Per Token: Einladung suchen (RLS erlaubt Lesen, wenn die E-Mail matcht; bei Link
  // ohne E-Mail brauchen wir eine andere Strategie. Für reine Link-Einladungen erlauben
  // wir das Annehmen, indem wir den Status updaten und dabei recipient_user_id setzen.
  // Das funktioniert nur, wenn die Einladung per E-Mail an die aktuelle Nutzerin ging.
  // Bei reinen Link-Einladungen wird der Token-Lookup serverseitig per RPC nötig –
  // hier vereinfacht: wir laden nach Token (RLS lässt es zu, wenn E-Mail passt) und
  // akzeptieren. Falls leer → freundliche Meldung.)
  async findByToken(token: string): Promise<CalendarShare | null> {
    const { data } = await supabase
      .from("calendar_shares")
      .select("*")
      .eq("invite_token", token)
      .maybeSingle();
    return (data as CalendarShare | null) ?? null;
  },

  async acceptByToken(token: string, currentUserId: string): Promise<CalendarShare | null> {
    // Nur Status updaten (recipient_user_id erst danach, damit RLS UPDATE durchlässt)
    const { data, error } = await supabase
      .from("calendar_shares")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        recipient_user_id: currentUserId,
      })
      .eq("invite_token", token)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as CalendarShare | null) ?? null;
  },
};

export const buildShareLink = (token: string) =>
  `${window.location.origin}/share/${token}`;

// Public iCal feed URL for Apple/Google Calendar subscriptions
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
export const buildICalUrl = (token: string) =>
  `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/calendar-feed/${token}.ics`;
export const buildWebcalUrl = (token: string) =>
  buildICalUrl(token).replace(/^https:\/\//, "webcal://");
