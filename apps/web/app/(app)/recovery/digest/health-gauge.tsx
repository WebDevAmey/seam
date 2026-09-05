// Adapted from causal-ai's weekly-digest gauge pattern: an SVG arc showing
// one real, computed number (Seam's recovery rate = recovered / leaked),
// not a fabricated "health score" — the only rate available from real
// digest fields without inventing a new metric.
export function HealthGauge({ rate }: { rate: number }) {
  const r = 68;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  const trackLength = circumference * 0.75;
  const clamped = Math.min(100, Math.max(0, rate));
  const fillLength = trackLength * (clamped / 100);
  const color = clamped >= 50 ? "var(--recovered)" : clamped >= 20 ? "var(--pending)" : "var(--at-risk)";

  return (
    <svg viewBox="0 0 200 160" className="w-[150px] sm:w-[170px]" aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--rule)"
        strokeWidth={13}
        strokeDasharray={`${trackLength} ${circumference - trackLength}`}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={13}
        strokeDasharray={`${fillLength} ${circumference - fillLength}`}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="32" fontWeight="600" className="fill-ink font-mono-figures">
        {clamped.toFixed(0)}%
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" letterSpacing="2" className="fill-muted uppercase font-mono-figures">
        recovered
      </text>
    </svg>
  );
}
