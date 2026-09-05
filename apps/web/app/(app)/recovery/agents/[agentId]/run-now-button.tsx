"use client";

import { useState, useTransition } from "react";
import { AgentProgress } from "@/components/agents/loading-states/agent-progress";
import type { TriggerableAgentId } from "@/lib/api";
import { runAgentNowAction } from "./run-actions";

export function RunNowButton({ agentId }: { agentId: TriggerableAgentId }) {
  const [pending, startTransition] = useTransition();
  const [ran, setRan] = useState(false);

  if (pending) {
    return <AgentProgress label="Running" className="text-primary" />;
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await runAgentNowAction(agentId);
          setRan(true);
        })
      }
      className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
    >
      {ran ? "Run again" : "Run now"}
    </button>
  );
}
