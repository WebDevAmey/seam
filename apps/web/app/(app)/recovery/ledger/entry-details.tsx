"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Hash, Copy, Check } from "lucide-react";
import type { LedgerEntry } from "@/lib/api";

type EntryConfig = {
  label: string;
  icon: typeof import("lucide-react").Shield;
  color: string;
} | null;

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function PayloadField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="font-mono-figures truncate text-ink">{String(value)}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={handleCopy} className="rounded p-0.5 text-muted transition-colors hover:text-ink" title="Copy hash">
      {copied ? <Check className="size-3 text-received" /> : <Copy className="size-3" />}
    </button>
  );
}

export function EntryDetails({ entry, config, payloadType }: { entry: LedgerEntry; config: EntryConfig; payloadType: string }) {
  const [expanded, setExpanded] = useState(false);
  const payload = entry.payload as Record<string, unknown> | null;

  return (
    <div className="rounded-lg border border-rule bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-tint/20"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-medium ${config?.color ?? "text-ink"}`}>
                {config?.label ?? payloadType}
              </span>
              <span className="font-mono-figures text-[11px] text-muted">seq {entry.seq}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              {new Date(entry.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-rule px-4 py-3 space-y-3">
          {/* Hashes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              <Hash className="size-3" />
              Hashes
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] text-muted">prev:</span>
              <code className="font-mono-figures flex-1 truncate rounded bg-primary-tint/30 px-1.5 py-0.5 text-[11px] text-ink">
                {entry.prevHash}
              </code>
              <CopyButton text={entry.prevHash} />
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] text-muted">hash:</span>
              <code className="font-mono-figures flex-1 truncate rounded bg-primary-tint/30 px-1.5 py-0.5 text-[11px] text-ink">
                {entry.hash}
              </code>
              <CopyButton text={entry.hash} />
            </div>
          </div>

          {/* Payload details */}
          {payload && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Payload
              </div>
              <div className="rounded bg-primary-tint/20 p-3 space-y-1.5">
                {typeof payload.actionId === "string" && <PayloadField label="action" value={payload.actionId} />}
                {typeof payload.leakId === "string" && <PayloadField label="leak" value={payload.leakId} />}
                {typeof payload.checkoutId === "string" && <PayloadField label="checkout" value={payload.checkoutId} />}
                {typeof payload.actionClass === "string" && <PayloadField label="class" value={payload.actionClass} />}
                {typeof payload.reason === "string" && <PayloadField label="reason" value={payload.reason} />}
                {typeof payload.customerPhone === "string" && <PayloadField label="phone" value={payload.customerPhone} />}
                {typeof payload.text === "string" && <PayloadField label="text" value={payload.text} />}
                {typeof payload.outcome === "string" && <PayloadField label="outcome" value={payload.outcome} />}
                {typeof payload.phone === "string" && typeof payload.customerPhone !== "string" && <PayloadField label="phone" value={payload.phone} />}
              </div>

              {/* Raw JSON toggle */}
              <details className="group">
                <summary className="cursor-pointer text-[11px] text-muted hover:text-ink">
                  Show raw JSON
                </summary>
                <pre className="mt-1.5 max-h-[200px] overflow-auto rounded bg-primary-tint/30 p-3 font-mono-figures text-[11px] text-ink">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Merchant */}
          <PayloadField label="merchant" value={entry.merchantId} />
        </div>
      )}
    </div>
  );
}
