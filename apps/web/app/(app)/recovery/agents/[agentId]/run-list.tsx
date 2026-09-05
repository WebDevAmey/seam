"use client";

import { useState } from "react";
import { Bot, History } from "lucide-react";
import { ToolResult, ToolResultOutput } from "@/components/agents/tool-result";
import { ThinkingShimmer } from "@/components/agents/loading-states/thinking-shimmer";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { AgentRunDetail, AgentRunSummary } from "@/lib/api";
import { getRunDetailAction } from "./run-actions";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN");
}

export function RunList({ agentId, runs }: { agentId: string; runs: AgentRunSummary[] }) {
  const [details, setDetails] = useState<Record<string, AgentRunDetail>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function onOpenChange(runId: string, open: boolean) {
    if (!open || details[runId]) return;
    setLoading(runId);
    const detail = await getRunDetailAction(agentId, runId);
    setDetails((prev) => ({ ...prev, [runId]: detail }));
    setLoading(null);
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-rule bg-surface">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No runs yet</EmptyTitle>
            <EmptyDescription>Trigger this agent, or check back after the next sweep.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {runs.map((run) => (
        <ToolResult
          key={run.id}
          tool={<Bot className="size-3.5" strokeWidth={1.8} />}
          title={run.summary}
          meta={`${formatWhen(run.startedAt)} · ${run.durationMs}ms`}
          status={run.status === "ok" ? "success" : "error"}
          onOpenChange={(open) => onOpenChange(run.id, open)}
        >
          {loading === run.id && <ThinkingShimmer>Loading run</ThinkingShimmer>}
          {details[run.id] && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Input</p>
                <ToolResultOutput language="json">{JSON.stringify(details[run.id]?.input ?? {}, null, 2)}</ToolResultOutput>
              </div>
              {details[run.id]?.error ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-at-risk">Error</p>
                  <ToolResultOutput language="json">{details[run.id]?.error ?? ""}</ToolResultOutput>
                </div>
              ) : (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Output</p>
                  <ToolResultOutput language="json">{JSON.stringify(details[run.id]?.output ?? {}, null, 2)}</ToolResultOutput>
                </div>
              )}
            </div>
          )}
        </ToolResult>
      ))}
    </div>
  );
}
