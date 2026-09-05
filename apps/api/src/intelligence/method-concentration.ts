export type AttemptFact = { method: string; status: string; attemptedAt: Date };

export type DailyRate = { date: string; method: string; total: number; declined: number; rate: number };

export type ConcentrationFinding = {
  method: string;
  currentRate: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  sampleSize: number;
};

const MIN_BASELINE_DAYS = 7;
const MIN_SAMPLE_SIZE = 5;
const Z_SCORE_THRESHOLD = 2;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeDailyRates(attempts: AttemptFact[]): DailyRate[] {
  const buckets = new Map<string, { date: string; method: string; total: number; declined: number }>();

  for (const attempt of attempts) {
    const date = dateKey(attempt.attemptedAt);
    const key = `${date}::${attempt.method}`;
    const bucket = buckets.get(key) ?? { date, method: attempt.method, total: 0, declined: 0 };
    bucket.total += 1;
    if (attempt.status === "failed") bucket.declined += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((b) => ({ ...b, rate: b.declined / b.total }));
}

/**
 * A method/issuer's decline rate today, compared to its own 14-day-ish
 * baseline via a real z-score — not a fixed percentage threshold, which
 * would misfire for a method that's simply always noisier than others.
 * Gated on both sides: not enough baseline history (< 7 days) or too small
 * a sample today (< 5 attempts) means "don't know yet," not "flag it
 * anyway" — same discipline the other detectors already follow.
 */
export function detectMethodConcentration(dailyRates: DailyRate[], today: string): ConcentrationFinding[] {
  const methods = new Set(dailyRates.map((r) => r.method));
  const findings: ConcentrationFinding[] = [];

  for (const method of methods) {
    const todayRow = dailyRates.find((r) => r.date === today && r.method === method);
    if (!todayRow || todayRow.total < MIN_SAMPLE_SIZE) continue;

    const baselineRates = dailyRates.filter((r) => r.method === method && r.date !== today).map((r) => r.rate);
    if (baselineRates.length < MIN_BASELINE_DAYS) continue;

    const mean = baselineRates.reduce((sum, r) => sum + r, 0) / baselineRates.length;
    const variance = baselineRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / baselineRates.length;
    const stdDev = Math.sqrt(variance);

    // A baseline with zero variance (every day identical) makes a
    // conventional z-score undefined (division by zero) — any deviation
    // from a perfectly consistent history is significant by definition,
    // not something to silently skip.
    const zScore = stdDev === 0 ? (todayRow.rate > mean ? Number.POSITIVE_INFINITY : 0) : (todayRow.rate - mean) / stdDev;

    if (zScore > Z_SCORE_THRESHOLD) {
      findings.push({
        method,
        currentRate: todayRow.rate,
        baselineMean: mean,
        baselineStdDev: stdDev,
        zScore,
        sampleSize: todayRow.total,
      });
    }
  }

  return findings;
}
