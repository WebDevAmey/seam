import { cn } from "@/lib/utils";

/**
 * A real, data-bound progress bar — deliberately not beUI's `Loader`
 * "percent" variant, which animates its own fake 0→100 loop on a timer
 * and has no prop for a real value. This renders whatever ratio it's
 * given, once, no animation loop pretending to be live progress.
 */
export function RatioBar({ value, className, trackClassName }: { value: number; className?: string; trackClassName?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-rule", trackClassName)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-primary transition-[width] duration-500", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}
