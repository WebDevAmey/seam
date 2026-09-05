export type BadgeTone = "neutral" | "primary" | "risk" | "recovered" | "pending";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-white/5 text-[#8a8a8a]",
  primary: "bg-[#3b82f6]/15 text-[#60a5fa]",
  risk: "bg-[#ef4444]/15 text-[#ef4444]",
  recovered: "bg-[#22c55e]/15 text-[#22c55e]",
  pending: "bg-[#f59e0b]/15 text-[#f59e0b]",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
