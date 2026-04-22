import { cn } from "@/lib/utils";

const PHASES: { key: string; label: string; varName: string }[] = [
  { key: "menstrual", label: "Menstruation", varName: "--phase-menstrual" },
  { key: "follicular", label: "Follikelphase", varName: "--phase-follicular" },
  { key: "ovulation", label: "Ovulation", varName: "--phase-ovulation" },
  { key: "luteal", label: "Lutealphase", varName: "--phase-luteal" },
];

export function PhaseLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="uppercase tracking-wide text-[10px]">Zyklusphasen:</span>
      {PHASES.map(p => (
        <span key={p.key} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: `hsl(var(${p.varName}))` }}
          />
          {p.label}
        </span>
      ))}
    </div>
  );
}
