"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AgentDisclosure } from "@/components/agents/agent-disclosure";
import { formatPaise, leakClassLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Leak } from "@/lib/api";

export function LeakGroup({
  leakClass,
  totalPaise,
  count,
  leaks,
  badgeLabel,
  badgeTone,
  defaultOpen = false,
}: {
  leakClass: string;
  totalPaise: string;
  count: number;
  leaks: Leak[];
  badgeLabel: string;
  badgeTone: BadgeTone;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="text-[14px] font-medium text-ink">{leakClassLabel(leakClass)}</span>
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </span>
        <span className="flex items-center gap-4">
          <span className="text-[13px] text-muted">
            {count} checkout{count === 1 ? "" : "s"}
          </span>
          <span className="font-mono-figures text-[15px] font-medium tabular-nums text-ink">{formatPaise(totalPaise)}</span>
          <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
        </span>
      </button>
      <AgentDisclosure id={contentId} open={open}>
        <div className="pb-2">
          {leaks.map((leak) => (
            <div key={leak.id} className="flex items-center justify-between border-t border-rule px-5 py-2.5 pl-8 text-[13px]">
              <span className="font-mono-figures text-muted">{leak.checkoutId}</span>
              <span className="flex items-baseline gap-4">
                <span className="font-mono-figures text-[12px] text-muted">evidence: {leak.evidenceEventIds.join(", ")}</span>
                <span className="font-mono-figures tabular-nums text-ink">{formatPaise(leak.amountPaise)}</span>
              </span>
            </div>
          ))}
        </div>
      </AgentDisclosure>
    </div>
  );
}
