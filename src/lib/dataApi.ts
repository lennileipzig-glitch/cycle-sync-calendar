// Datenzugriff: wählt zwischen Supabase (eingeloggt) und Guest-Store (lokal)
import { supabase } from "@/integrations/supabase/client";
import { isGuest, guestStore, type GuestEvent } from "./guestStore";

export interface DailyLog {
  id: string;
  log_date: string;
  mood: string | null;
  energy_level: string | null;
  symptoms: string[];
  notes: string | null;
}
export interface Todo { id: string; title: string; completed: boolean; todo_date: string; }

export const dataApi = {
  // ---- Logs ----
  async getLog(userId: string | null, date: string): Promise<DailyLog | null> {
    if (isGuest()) {
      const l = guestStore.getLog(date);
      return l ? { ...l, symptoms: l.symptoms ?? [] } : null;
    }
    if (!userId) return null;
    const { data } = await supabase.from("daily_logs").select("*")
      .eq("user_id", userId).eq("log_date", date).maybeSingle();
    return data as DailyLog | null;
  },

  async getLatestLog(userId: string | null): Promise<DailyLog | null> {
    if (isGuest()) {
      const logs = guestStore.getLogs().sort((a, b) => b.log_date.localeCompare(a.log_date));
      const l = logs[0];
      return l ? { ...l, symptoms: l.symptoms ?? [] } : null;
    }
    if (!userId) return null;
    const { data } = await supabase.from("daily_logs").select("*")
      .eq("user_id", userId).order("log_date", { ascending: false }).limit(1).maybeSingle();
    return data as DailyLog | null;
  },

  async upsertLog(userId: string | null, log: Omit<DailyLog, "id">): Promise<void> {
    if (isGuest()) { guestStore.upsertLog(log); return; }
    if (!userId) return;
    await supabase.from("daily_logs").upsert(
      { user_id: userId, ...log },
      { onConflict: "user_id,log_date" },
    );
  },

  async bulkInsertLogs(userId: string | null, logs: Omit<DailyLog, "id">[]): Promise<void> {
    if (isGuest()) {
      logs.forEach(l => guestStore.upsertLog(l));
      return;
    }
    if (!userId || logs.length === 0) return;
    const rows = logs.map(l => ({ user_id: userId, ...l }));
    await supabase.from("daily_logs").upsert(rows, { onConflict: "user_id,log_date" });
  },

  // ---- Todos ----
  async getTodos(userId: string | null, date: string): Promise<Todo[]> {
    if (isGuest()) return guestStore.getTodos(date);
    if (!userId) return [];
    const { data } = await supabase.from("todos").select("id,title,completed,todo_date")
      .eq("user_id", userId).eq("todo_date", date).order("created_at");
    return (data as Todo[]) ?? [];
  },

  async addTodo(userId: string | null, date: string, title: string): Promise<Todo | null> {
    if (isGuest()) return guestStore.addTodo(date, title);
    if (!userId) return null;
    const { data } = await supabase.from("todos")
      .insert({ user_id: userId, todo_date: date, title }).select().single();
    return data as Todo | null;
  },

  async toggleTodo(userId: string | null, id: string, completed: boolean): Promise<void> {
    if (isGuest()) { guestStore.updateTodo(id, { completed }); return; }
    await supabase.from("todos").update({ completed }).eq("id", id);
  },

  async deleteTodo(userId: string | null, id: string): Promise<void> {
    if (isGuest()) { guestStore.deleteTodo(id); return; }
    await supabase.from("todos").delete().eq("id", id);
  },

  // ---- Events ----
  async getEvents(userId: string | null): Promise<GuestEvent[]> {
    if (isGuest()) return guestStore.getEvents();
    if (!userId) return [];
    const { data } = await supabase.from("calendar_events").select("*")
      .eq("user_id", userId).order("starts_at");
    return (data as GuestEvent[]) ?? [];
  },

  async getEventsForDate(userId: string | null, date: string): Promise<GuestEvent[]> {
    const all = await this.getEvents(userId);
    return all.filter(e => e.starts_at.slice(0, 10) === date);
  },

  async addEvents(userId: string | null, events: Omit<GuestEvent, "id">[]): Promise<void> {
    if (isGuest()) { guestStore.addEvents(events); return; }
    if (!userId || events.length === 0) return;
    const rows = events.map(e => ({ user_id: userId, ...e }));
    await supabase.from("calendar_events").insert(rows);
  },
};
