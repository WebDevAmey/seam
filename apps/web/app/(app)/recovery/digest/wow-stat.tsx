import { ArrowUp, ArrowDown, Minus } from "lucide-react";

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? null : 100;
  return ((current - prior) / prior) * 100;
}

export function WoWStat({ label, current, prior, invert = false }: { label: string; current: number; prior: number; invert?: boolean }) {
  const pct = pctChange(current, prior);

  if (pct === null) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="font-mono-figures text-[13px] text-muted">no prior data</span>
      </div>
    );
  }

  const isGood = invert ? pct < 0 : pct > 0;
  const isBad = invert ? pct > 0 : pct < 0;
  const toneClass = isGood ? "text-recovered" : isBad ? "text-at-risk" : "text-muted";
  const Icon = isGood ? ArrowUp : isBad ? ArrowDown : Minus;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
      <div className={`flex items-center gap-1 font-mono-figures text-[13px] font-medium tabular-nums ${toneClass}`}>
        <Icon className="size-3 shrink-0" strokeWidth={2.2} />
        {pct > 0 ? "+" : ""}
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}
