import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/cycle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo { id: string; title: string; completed: boolean; }

export function TodoList({ userId, date }: { userId: string; date: Date }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const day = fmtDate(date);

  const load = async () => {
    const { data } = await supabase.from("todos").select("id,title,completed")
      .eq("user_id", userId).eq("todo_date", day).order("created_at");
    setTodos((data as Todo[]) ?? []);
  };
  useEffect(() => { load(); }, [userId, day]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const { data } = await supabase.from("todos")
      .insert({ user_id: userId, todo_date: day, title: input.trim() }).select().single();
    if (data) setTodos(prev => [...prev, data as Todo]);
    setInput("");
  };

  const toggle = async (t: Todo) => {
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, completed: !x.completed } : x));
    await supabase.from("todos").update({ completed: !t.completed }).eq("id", t.id);
  };

  const remove = async (id: string) => {
    setTodos(prev => prev.filter(x => x.id !== id));
    await supabase.from("todos").delete().eq("id", id);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Neue Aufgabe..." />
        <Button type="submit" size="icon" variant="secondary"><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="space-y-1.5">
        {todos.length === 0 && <li className="text-sm text-muted-foreground italic">Noch keine Aufgaben für diesen Tag.</li>}
        {todos.map(t => (
          <li key={t.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <Checkbox checked={t.completed} onCheckedChange={() => toggle(t)} />
            <span className={cn("flex-1 text-sm", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
            <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
