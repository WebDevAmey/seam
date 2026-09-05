"use client";

import { useState, useTransition } from "react";
import { ApprovalCard, type ApprovalCardStatus } from "@/components/agents/approval-card";
import { approveAction, rejectAction } from "./queue-actions";
import { formatPaise, leakClassLabel } from "@/lib/format";

export function ApprovalItem({
  actionId,
  leakClass,
  checkoutId,
  evPaise,
  shieldReason,
}: {
  actionId: string;
  leakClass: string;
  checkoutId: string;
  evPaise: string;
  shieldReason: string | null;
}) {
  const [status, setStatus] = useState<ApprovalCardStatus>("pending");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setStatus("submitting");
    startTransition(async () => {
      const res = await approveAction(actionId);
      if ("outcome" in res && res.outcome === "not_connected") {
        setStatus("changes-requested");
        setResult("Razorpay isn't connected for this merchant yet, so there's nothing to send this through. Connect it to enable real approval.");
        return;
      }
      if ("error" in res) {
        setStatus("changes-requested");
        setResult(res.error);
        return;
      }
      setStatus("approved");
      setResult("Dispatched.");
    });
  }

  function handleReject() {
    setStatus("submitting");
    startTransition(async () => {
      const res = await rejectAction(actionId);
      if ("error" in res) {
        setStatus("changes-requested");
        setResult(res.error);
        return;
      }
      setStatus("rejected");
      setResult("Declined. This won't be sent.");
    });
  }

  return (
    <ApprovalCard
      title={leakClassLabel(leakClass)}
      description={`Checkout ${checkoutId}. Predicted recovery ${formatPaise(evPaise)}${shieldReason ? `. ${shieldReason}.` : "."}`}
      status={status}
      result={result}
      onApprove={handleApprove}
      onReject={handleReject}
      approveLabel={pending ? "Working…" : "Approve & send"}
    />
  );
}
