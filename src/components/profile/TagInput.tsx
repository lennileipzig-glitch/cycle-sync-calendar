import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

export function TagInput({ values, onChange, placeholder, suggestions = [] }: Props) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.includes(v)) return;
    onChange([...values, v]);
    setInput("");
  };
  const remove = (v: string) => onChange(values.filter(x => x !== v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {values.length === 0 && <span className="text-xs text-muted-foreground italic">Noch nichts hinzugefügt.</span>}
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm bg-primary/10 border border-primary/20">
            {v}
            <button type="button" onClick={() => remove(v)} className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-primary/20" aria-label={`${v} entfernen`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder={placeholder}
        />
        <Button type="button" size="icon" variant="secondary" onClick={() => add(input)} aria-label="Hinzufügen">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter(s => !values.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn("px-2.5 py-1 rounded-full text-xs border border-dashed border-border hover:border-primary/40 hover:bg-muted transition")}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
