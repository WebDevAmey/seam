"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2, Shield, Database, Clock, Hash } from "lucide-react";
import { verifyLedgerAction } from "@/app/(app)/recovery/ledger/verify-action";
import type { VerifyResult } from "@/lib/api";

export function VerifyButton() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        onClick={() => startTransition(async () => setResult(await verifyLedgerAction()))}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Recomputing from genesis…
          </>
        ) : (
          <>
            <Shield className="size-3.5" />
            Verify entire chain
          </>
        )}
      </button>

      {result && (
        <div className={`w-full max-w-[340px] rounded-lg border p-4 text-[12px] ${
          result.valid
            ? "border-received/30 bg-received/5"
            : "border-at-risk/30 bg-at-risk/5"
        }`}>
          <div className="flex items-center gap-2">
            {result.valid ? (
              <CheckCircle2 className="size-4 shrink-0 text-received" strokeWidth={2} />
            ) : (
              <XCircle className="size-4 shrink-0 text-at-risk" strokeWidth={2} />
            )}
            <span className={`font-semibold ${result.valid ? "text-received" : "text-at-risk"}`}>
              {result.valid ? "Chain verified" : `Broken at seq ${result.brokenAtSeq}`}
            </span>
          </div>

          {!result.valid && (
            <p className="mt-1.5 text-at-risk/80">{result.reason}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/5 pt-3">
            <div className="flex items-center gap-1.5 text-muted">
              <Database className="size-3" />
              <span>{result.totalEntries} entries</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Hash className="size-3" />
              <span>{result.merchantsAffected} merchant{result.merchantsAffected === 1 ? "" : "s"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Clock className="size-3" />
              <span>{result.elapsedMs.toFixed(0)}ms</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Hash className="size-3" />
              <span>seq {result.firstSeq}–{result.lastSeq}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
