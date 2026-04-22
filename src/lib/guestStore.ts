// Lokaler Speicher für Guest-Mode (kein Account)
import type { Profile } from "@/hooks/useProfile";

const GUEST_FLAG = "luna-guest-mode";
const PROFILE_KEY = "luna-guest-profile";
const LOGS_KEY = "luna-guest-logs";
const TODOS_KEY = "luna-guest-todos";
const EVENTS_KEY = "luna-guest-events";

export const isGuest = () => typeof window !== "undefined" && localStorage.getItem(GUEST_FLAG) === "1";
export const setGuest = (v: boolean) => v ? localStorage.setItem(GUEST_FLAG, "1") : localStorage.removeItem(GUEST_FLAG);

export interface GuestProfile extends Omit<Profile, "id"> {
  onboarding_completed: boolean;
  in_menopause: boolean;
}

export interface GuestLog {
  id: string;
  log_date: string;
  mood: string | null;
  energy_level: string | null;
  symptoms: string[];
  notes: string | null;
}

export interface GuestTodo {
  id: string;
  todo_date: string;
  title: string;
  completed: boolean;
  energy_cost?: number | null;
  is_flexible?: boolean;
}

export interface GuestEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  source: string;
  energy_cost?: number | null;
  is_flexible?: boolean;
  recurrence_freq?: "daily" | "weekly" | "monthly" | null;
  recurrence_until?: string | null;
}

const read = <T>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

export const guestStore = {
  getProfile(): GuestProfile {
    const stored = read<Partial<GuestProfile>>(PROFILE_KEY, {} as Partial<GuestProfile>);
    const defaults: GuestProfile = {
      display_name: "Gast",
      avg_cycle_length: 28,
      avg_period_length: 5,
      last_period_start: null,
      onboarding_completed: false,
      in_menopause: false,
      diet_style: "omnivore",
      diet_intolerances: [],
      favorite_foods: [],
      sports: [],
      sport_level: "regular",
      sport_frequency_per_week: 3,
      notifications_enabled: false,
      notification_time: "09:00",
      notification_topics: ["energy_forecast", "checkin"],
      custom_symptoms: [],
    };
    return { ...defaults, ...stored };
  },
  updateProfile(patch: Partial<GuestProfile>) {
    const p = { ...this.getProfile(), ...patch };
    write(PROFILE_KEY, p);
    return p;
  },
  getLogs(): GuestLog[] { return read<GuestLog[]>(LOGS_KEY, []); },
  upsertLog(log: Omit<GuestLog, "id"> & { id?: string }) {
    const logs = this.getLogs();
    const idx = logs.findIndex(l => l.log_date === log.log_date);
    if (idx >= 0) logs[idx] = { ...logs[idx], ...log };
    else logs.push({ id: crypto.randomUUID(), ...log });
    write(LOGS_KEY, logs);
    return logs.find(l => l.log_date === log.log_date)!;
  },
  getLog(date: string) { return this.getLogs().find(l => l.log_date === date) ?? null; },
  getTodos(date: string): GuestTodo[] { return read<GuestTodo[]>(TODOS_KEY, []).filter(t => t.todo_date === date); },
  addTodo(date: string, title: string, extra?: { energy_cost?: number | null; is_flexible?: boolean }) {
    const todos = read<GuestTodo[]>(TODOS_KEY, []);
    const t: GuestTodo = {
      id: crypto.randomUUID(), todo_date: date, title, completed: false,
      energy_cost: extra?.energy_cost ?? null,
      is_flexible: extra?.is_flexible ?? false,
    };
    todos.push(t); write(TODOS_KEY, todos); return t;
  },
  updateTodo(id: string, patch: Partial<GuestTodo>) {
    const todos = read<GuestTodo[]>(TODOS_KEY, []).map(t => t.id === id ? { ...t, ...patch } : t);
    write(TODOS_KEY, todos);
  },
  deleteTodo(id: string) {
    write(TODOS_KEY, read<GuestTodo[]>(TODOS_KEY, []).filter(t => t.id !== id));
  },
  getEvents(): GuestEvent[] { return read<GuestEvent[]>(EVENTS_KEY, []); },
  addEvents(events: Omit<GuestEvent, "id">[]) {
    const all = read<GuestEvent[]>(EVENTS_KEY, []);
    events.forEach(e => all.push({ id: crypto.randomUUID(), ...e }));
    write(EVENTS_KEY, all);
  },
  clearAll() {
    [PROFILE_KEY, LOGS_KEY, TODOS_KEY, EVENTS_KEY, GUEST_FLAG].forEach(k => localStorage.removeItem(k));
  },
};
