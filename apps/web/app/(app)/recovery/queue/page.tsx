import { getLeaks, getRecoveryActions } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise, leakClassLabel } from "@/lib/format";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Inbox } from "lucide-react";
import { ApprovalItem } from "./approval-item";

const STATE_LABEL: Record<string, string> = {
  DISPATCHED: "Sent",
  FAILED: "Blocked / failed",
};

export default async function RecoveryQueuePage() {
  const merchantId = await requireCurrentMerchantId();
  const [actions, leaks] = await Promise.all([getRecoveryActions(merchantId), getLeaks(merchantId)]);
  const leakById = new Map(leaks.map((leak) => [leak.id, leak]));

  const awaitingApproval = actions.filter((a) => a.state === "RESERVED");
  const resolved = actions.filter((a) => a.state !== "RESERVED");

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="font-heading text-[20px] font-semibold text-black">Recovery queue</h1>
      <p className="mt-1 max-w-[64ch] text-[13px] text-gray-600">
        One row per proposed action, including the ones Shield blocked. Blocked actions stay visible
        with their reason. Hiding them would defeat the point.
      </p>

      {awaitingApproval.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-[14px] font-semibold text-black">Waiting on you</h2>
          <div className="mt-3 flex flex-col gap-3">
            {awaitingApproval.map((action) => {
              const leak = leakById.get(action.leakId);
              return (
                <ApprovalItem
                  key={action.id}
                  actionId={action.id}
                  leakClass={leak?.class ?? action.leakId}
                  checkoutId={action.checkoutId}
                  evPaise={action.evPaise}
                  shieldReason={action.shieldReason}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8">
        {awaitingApproval.length > 0 && <h2 className="font-heading mb-3 text-[14px] font-semibold text-black">Everything else</h2>}
        {resolved.length === 0 && actions.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>No recovery actions yet</EmptyTitle>
                <EmptyDescription>Once Seam finds a leak worth acting on, it shows up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
        {resolved.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            {resolved.map((action, i) => {
              const leak = leakById.get(action.leakId);
              return (
                <div key={action.id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-baseline gap-3">
                      <span className="text-[14px] font-medium text-black">
                        {leak ? leakClassLabel(leak.class) : action.leakId}
                      </span>
                      <span className="font-mono-figures text-[11px] text-gray-500">{action.actionClass}</span>
                    </span>
                    <AnimatedBadge status={action.state === "DISPATCHED" ? "success" : "danger"} size="sm">
                      {STATE_LABEL[action.state] ?? action.state}
                    </AnimatedBadge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-gray-600">
                    <span className="font-mono-figures">checkout: {action.checkoutId}</span>
                    <span className="font-mono-figures tabular-nums">EV {formatPaise(action.evPaise)}</span>
                    <span>
                      Shield: <span className="font-mono-figures">{action.shieldVerdict}</span>
                      {action.shieldReason ? ` (${action.shieldReason})` : ""}
                    </span>
                    {action.rzpRef && <span className="font-mono-figures">ref: {action.rzpRef}</span>}
                  </div>
                  {leak && (
                    <p className="font-mono-figures mt-1 text-[12px] text-gray-500">
                      evidence: {leak.evidenceEventIds.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
