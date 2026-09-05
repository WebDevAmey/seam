"use client";

import { useState, useTransition } from "react";
import { verifyLedgerAction } from "@/app/(app)/recovery/ledger/verify-action";
import type { VerifyResult } from "@/lib/api";

export function VerifyButton() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        onClick={() => startTransition(async () => setResult(await verifyLedgerAction()))}
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Recomputing from genesis…" : "Verify chain"}
      </button>
      {result && (
        <p className={`mt-3 text-[13px] font-medium ${result.valid ? "text-recovered" : "text-at-risk"}`}>
          {result.valid
            ? "Valid. Every entry checks out from the start."
            : `Broken at seq ${result.brokenAtSeq}: ${result.reason}`}
        </p>
      )}
    </div>
  );
}
