import { getLeaks, type Leak } from "@/lib/api";
import { requireDemoMerchantId } from "@/lib/demo-merchant";
import { formatPaise, leakClassLabel } from "@/lib/format";

// Recoverable-by-a-message, so they belong in the headline figure.
const HARD_RECOVERABLE = new Set(["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"]);
// Recoverable sometimes, at a lower expected value — shown, never blended
// into the headline number (PRD §5: never sum potential with realized).
const SOFT_RECOVERABLE = new Set(["SILENT_ABANDON"]);

type Group = { leakClass: string; totalPaise: bigint; count: number; leaks: Leak[] };

function groupLeaks(leaks: Leak[]): Group[] {
  const byClass = new Map<string, Group>();
  for (const leak of leaks) {
    const existing = byClass.get(leak.class);
    if (existing) {
      existing.totalPaise += BigInt(leak.amountPaise);
      existing.count += 1;
      existing.leaks.push(leak);
    } else {
      byClass.set(leak.class, { leakClass: leak.class, totalPaise: BigInt(leak.amountPaise), count: 1, leaks: [leak] });
    }
  }
  return Array.from(byClass.values()).sort((a, b) => (b.totalPaise > a.totalPaise ? 1 : -1));
}

export default async function LeakMapPage() {
  const merchantId = requireDemoMerchantId();
  const leaks = await getLeaks(merchantId);
  const groups = groupLeaks(leaks);

  const recoverableTodayPaise = groups
    .filter((g) => HARD_RECOVERABLE.has(g.leakClass))
    .reduce((sum, g) => sum + g.totalPaise, 0n);

  return (
    <div className="px-6 py-10 sm:px-10">
      <p className="font-mono-figures text-[11px] uppercase tracking-[0.18em] text-muted">
        Recoverable today
      </p>
      <p className="font-mono-figures mt-2 text-[56px] leading-none font-semibold tabular-nums sm:text-[72px]">
        {formatPaise(recoverableTodayPaise)}
      </p>
      <p className="mt-3 max-w-[60ch] text-[13px] text-muted">
        Payment-blocked and issuer-downtime leaks only — the hard, recoverable-by-a-message figure.
        Silent abandons below are shown separately; they&apos;re real, but lower confidence, and never
        get blended into this number.
      </p>

      <div className="mt-12 border-t border-rule">
        {groups.length === 0 && (
          <p className="border-b border-rule py-6 text-[13px] text-muted">
            No leaks detected yet for this merchant.
          </p>
        )}
        {groups.map((group) => (
          <details key={group.leakClass} className="group border-b border-rule">
            <summary className="flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline gap-3">
                <span className="text-[15px] font-medium">{leakClassLabel(group.leakClass)}</span>
                {!HARD_RECOVERABLE.has(group.leakClass) && !SOFT_RECOVERABLE.has(group.leakClass) && (
                  <span className="text-[11px] uppercase tracking-wide text-muted">diagnostic only</span>
                )}
                {SOFT_RECOVERABLE.has(group.leakClass) && (
                  <span className="text-[11px] uppercase tracking-wide text-muted">sometimes recoverable</span>
                )}
              </span>
              <span className="flex items-baseline gap-4">
                <span className="text-[13px] text-muted">
                  {group.count} checkout{group.count === 1 ? "" : "s"}
                </span>
                <span className="font-mono-figures text-[17px] tabular-nums">{formatPaise(group.totalPaise)}</span>
              </span>
            </summary>
            <div className="pb-5">
              {group.leaks.map((leak) => (
                <div
                  key={leak.id}
                  className="flex items-center justify-between border-t border-rule py-3 pl-4 text-[13px]"
                >
                  <span className="font-mono-figures text-muted">{leak.checkoutId}</span>
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono-figures text-muted">
                      evidence: {leak.evidenceEventIds.join(", ")}
                    </span>
                    <span className="font-mono-figures tabular-nums">{formatPaise(leak.amountPaise)}</span>
                  </span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
