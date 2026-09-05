"use client";

import { useState, useTransition } from "react";
import { PlayCircle } from "lucide-react";
import { AgentProgress } from "@/components/agents/loading-states/agent-progress";
import { runAllAgentsAction } from "./fleet-actions";

export function RunAllButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (pending) {
    return <AgentProgress label="Sweeping the fleet" className="text-primary" />;
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await runAllAgentsAction();
          setDone(true);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
    >
      <PlayCircle className="size-3.5" strokeWidth={1.8} />
      {done ? "Run all agents again" : "Run all agents"}
    </button>
  );
}
