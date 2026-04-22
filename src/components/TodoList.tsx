import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/cycle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataApi, type Todo } from "@/lib/dataApi";

export function TodoList({ userId, date }: { userId: string | null; date: Date }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const day = fmtDate(date);

  const load = async () => setTodos(await dataApi.getTodos(userId, day));
  useEffect(() => { load(); }, [userId, day]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const t = await dataApi.addTodo(userId, day, input.trim());
    if (t) setTodos(prev => [...prev, t]);
    setInput("");
  };

  const toggle = async (t: Todo) => {
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, completed: !x.completed } : x));
    await dataApi.toggleTodo(userId, t.id, !t.completed);
  };

  const remove = async (id: string) => {
    setTodos(prev => prev.filter(x => x.id !== id));
    await dataApi.deleteTodo(userId, id);
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
