import { ArrowUp, ArrowDown, Minus } from "lucide-react";

function pctChange(current: number, prior: number): number | "new" | "none" {
  if (prior === 0 && current === 0) return "none";
  if (prior === 0) return "new";
  return ((current - prior) / prior) * 100;
}

function formatValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

export function WoWStat({ label, current, prior, invert = false, isCurrency = false }: { label: string; current: number; prior: number; invert?: boolean; isCurrency?: boolean }) {
  const pct = pctChange(current, prior);

  if (pct === "none") {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="font-mono-figures text-[13px] text-muted">no data</span>
      </div>
    );
  }

  if (pct === "new") {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono-figures text-[13px] font-medium text-ink">{isCurrency ? formatValue(current) : current}</span>
          <span className="font-mono-figures text-[11px] text-[#3b82f6]">new</span>
        </div>
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
      <div className="flex items-center gap-2">
        <span className="font-mono-figures text-[13px] font-medium text-ink">{isCurrency ? formatValue(current) : current}</span>
        <div className={`flex items-center gap-0.5 font-mono-figures text-[11px] font-medium tabular-nums ${toneClass}`}>
          <Icon className="size-2.5 shrink-0" strokeWidth={2.2} />
          {pct > 0 ? "+" : ""}
          {pct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
