import { getLeaks, getRecoveryActions } from "@/lib/api";
import { requireDemoMerchantId } from "@/lib/demo-merchant";
import { formatPaise, leakClassLabel } from "@/lib/format";

const STATE_LABEL: Record<string, string> = {
  RESERVED: "Awaiting approval",
  DISPATCHED: "Sent",
  FAILED: "Blocked / failed",
};

function stateColor(state: string, shieldVerdict: string): string {
  if (shieldVerdict === "BLOCK" || state === "FAILED") return "text-at-risk";
  if (state === "DISPATCHED") return "text-recovered";
  return "text-muted";
}

export default async function RecoveryQueuePage() {
  const merchantId = requireDemoMerchantId();
  const [actions, leaks] = await Promise.all([getRecoveryActions(merchantId), getLeaks(merchantId)]);
  const leakById = new Map(leaks.map((leak) => [leak.id, leak]));

  return (
    <div className="px-6 py-10 sm:px-10">
      <h1 className="text-[15px] font-medium">Recovery queue</h1>
      <p className="mt-2 max-w-[60ch] text-[13px] text-muted">
        One row per proposed action — including the ones Shield blocked. Blocked actions stay visible
        with their reason; hiding them would defeat the point.
      </p>

      <div className="mt-8 border-t border-rule">
        {actions.length === 0 && (
          <p className="border-b border-rule py-6 text-[13px] text-muted">
            No recovery actions yet for this merchant.
          </p>
        )}
        {actions.map((action) => {
          const leak = leakById.get(action.leakId);
          return (
            <div key={action.id} className="border-b border-rule py-5">
              <div className="flex items-center justify-between">
                <span className="flex items-baseline gap-3">
                  <span className="text-[14px] font-medium">
                    {leak ? leakClassLabel(leak.class) : action.leakId}
                  </span>
                  <span className="font-mono-figures text-[12px] text-muted">{action.actionClass}</span>
                </span>
                <span className={`text-[13px] font-medium ${stateColor(action.state, action.shieldVerdict)}`}>
                  {STATE_LABEL[action.state] ?? action.state}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted">
                <span className="font-mono-figures">
                  checkout: {action.checkoutId}
                </span>
                <span className="font-mono-figures tabular-nums">EV {formatPaise(action.evPaise)}</span>
                <span>
                  Shield: <span className="font-mono-figures">{action.shieldVerdict}</span>
                  {action.shieldReason ? ` — ${action.shieldReason}` : ""}
                </span>
                {action.rzpRef && <span className="font-mono-figures">ref: {action.rzpRef}</span>}
              </div>
              {leak && (
                <p className="font-mono-figures mt-1 text-[12px] text-muted">
                  evidence: {leak.evidenceEventIds.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
