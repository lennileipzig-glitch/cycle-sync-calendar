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
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  todo_date: string;
  energy_cost?: number | null;
  is_flexible?: boolean;
}

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

  async addTodo(
    userId: string | null,
    date: string,
    title: string,
    extra?: { energy_cost?: number | null; is_flexible?: boolean },
  ): Promise<Todo | null> {
    if (isGuest()) return guestStore.addTodo(date, title, extra);
    if (!userId) return null;
    const { data } = await supabase.from("todos")
      .insert({
        user_id: userId,
        todo_date: date,
        title,
        energy_cost: extra?.energy_cost ?? null,
        is_flexible: extra?.is_flexible ?? false,
      })
      .select().single();
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
    // RLS lädt automatisch eigene + akzeptiert geteilte Events
    const { data: events } = await supabase.from("calendar_events").select("*").order("starts_at");
    const list = (events ?? []) as GuestEvent[];

    // Owner-Namen + Phasen-Sichtbarkeit für geteilte Events ergänzen
    const foreignOwnerIds = Array.from(new Set(
      list.filter(e => e.user_id && e.user_id !== userId).map(e => e.user_id as string),
    ));
    if (foreignOwnerIds.length > 0) {
      const [{ data: profilesData }, { data: sharesData }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", foreignOwnerIds),
        supabase.from("calendar_shares").select("owner_id, show_phases").eq("status", "accepted").in("owner_id", foreignOwnerIds),
      ]);
      const nameMap = new Map((profilesData ?? []).map(p => [p.id, p.display_name as string | null]));
      const phaseMap = new Map((sharesData ?? []).map(s => [s.owner_id, s.show_phases as boolean]));
      return list.map(e => {
        if (!e.user_id || e.user_id === userId) return e;
        return {
          ...e,
          _shared_owner_name: nameMap.get(e.user_id) ?? "geteilt",
          _shared_show_phases: phaseMap.get(e.user_id) ?? false,
        };
      });
    }
    return list;
  },

  async getEventsForDate(userId: string | null, date: string): Promise<GuestEvent[]> {
    const all = await this.getEvents(userId);
    return all.filter(e => e.starts_at.slice(0, 10) === date);
  },

  async addEvents(userId: string | null, events: Omit<GuestEvent, "id">[], opts?: { sharedVia?: string; ownerUserId?: string }): Promise<GuestEvent[]> {
    // Wiederkehrende Termine zu Einzel-Events expandieren
    const expanded: Omit<GuestEvent, "id">[] = [];
    for (const e of events) {
      expanded.push(e);
      if (!e.recurrence_freq || !e.recurrence_until) continue;
      const start = new Date(e.starts_at);
      const end = e.ends_at ? new Date(e.ends_at) : null;
      const until = new Date(`${e.recurrence_until}T23:59:59`);
      const step = e.recurrence_freq;
      const advance = (d: Date): Date => {
        const n = new Date(d);
        if (step === "daily") n.setDate(n.getDate() + 1);
        else if (step === "weekly") n.setDate(n.getDate() + 7);
        else if (step === "monthly") n.setMonth(n.getMonth() + 1);
        return n;
      };
      let cur = advance(start);
      let curEnd = end ? advance(end) : null;
      let safety = 0;
      while (cur <= until && safety < 366) {
        expanded.push({
          ...e,
          starts_at: cur.toISOString(),
          ends_at: curEnd ? curEnd.toISOString() : null,
          recurrence_freq: null,
          recurrence_until: null,
        });
        cur = advance(cur);
        if (curEnd) curEnd = advance(curEnd);
        safety++;
      }
    }
    if (isGuest()) {
      const before = guestStore.getEvents().length;
      guestStore.addEvents(expanded);
      return guestStore.getEvents().slice(before);
    }
    if (!userId || expanded.length === 0) return [];
    // UI-only Felder rausstrippen + Owner setzen (bei Beitrag in fremdem Kalender)
    const targetOwner = opts?.ownerUserId ?? userId;
    const rows = expanded.map(({ _shared_owner_name, _shared_show_phases, user_id, shared_via, ...rest }) => ({
      ...rest,
      user_id: targetOwner,
      shared_via: opts?.sharedVia ?? null,
    }));
    const { data, error } = await supabase.from("calendar_events").insert(rows).select();
    if (error) {
      console.error("addEvents insert error", error, rows);
      throw error;
    }
    return (data ?? []) as GuestEvent[];
  },

  async updateEvent(userId: string | null, id: string, patch: Partial<GuestEvent>): Promise<void> {
    if (isGuest()) { guestStore.updateEvent(id, patch); return; }
    if (!userId) return;
    // UI-only Felder rausstrippen
    const { _shared_owner_name, _shared_show_phases, user_id, id: _i, ...rest } = patch as GuestEvent;
    const { error } = await supabase.from("calendar_events").update(rest).eq("id", id);
    if (error) { console.error("updateEvent error", error); throw error; }
  },

  async deleteEvent(userId: string | null, id: string): Promise<void> {
    if (isGuest()) { guestStore.deleteEvent(id); return; }
    if (!userId) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) { console.error("deleteEvent error", error); throw error; }
  },

  /** Verschiebt ein Event auf ein anderes Datum (Drag & Drop). Uhrzeit bleibt erhalten. */
  async moveEventToDate(userId: string | null, event: GuestEvent, newDateStr: string): Promise<void> {
    const oldStart = new Date(event.starts_at);
    const oldEnd = event.ends_at ? new Date(event.ends_at) : null;
    const [y, m, d] = newDateStr.split("-").map(Number);
    const newStart = new Date(oldStart);
    newStart.setFullYear(y, m - 1, d);
    let newEnd: Date | null = null;
    if (oldEnd) {
      const durMs = oldEnd.getTime() - oldStart.getTime();
      newEnd = new Date(newStart.getTime() + durMs);
    }
    const patch: Partial<GuestEvent> = {
      starts_at: newStart.toISOString(),
      ends_at: newEnd ? newEnd.toISOString() : null,
    };
    await this.updateEvent(userId, event.id, patch);
  },
};
