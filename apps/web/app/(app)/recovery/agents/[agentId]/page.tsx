import Link from "next/link";
import { ArrowLeft, MessageSquare, MessagesSquare } from "lucide-react";
import { getAgentRuns, getAgents, type TriggerableAgentId } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { Badge } from "@/components/ui/badge";
import { RatioBar } from "@/components/ui/ratio-bar";
import { RunNowButton } from "./run-now-button";
import { RunList } from "./run-list";

const TRIGGERABLE = new Set<TriggerableAgentId>(["opportunities", "detector", "diagnosis", "recovery", "shield"]);

export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const merchantId = await requireCurrentMerchantId();
  const [agents, runs] = await Promise.all([getAgents(merchantId), getAgentRuns(merchantId, agentId)]);
  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="px-6 py-8 sm:px-10">
        <p className="text-[13px] text-muted">No such agent.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-10">
      <Link href="/recovery/agents" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-primary">
        <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        All agents
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-primary">{agent.role}</p>
          <h1 className="mt-0.5 font-heading text-[22px] font-semibold text-ink">{agent.name}</h1>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-muted">{agent.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={agent.kind === "llm-assisted" ? "pending" : "neutral"}>
            {agent.kind === "llm-assisted" ? "LLM-assisted" : "Deterministic"}
          </Badge>
          {TRIGGERABLE.has(agentId as TriggerableAgentId) && <RunNowButton agentId={agentId as TriggerableAgentId} />}
          {agentId === "store_chat" && (
            <Link
              href="/recovery/chat"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <MessageSquare className="size-3.5" strokeWidth={1.8} />
              Open chat
            </Link>
          )}
          {agentId === "conversations" && (
            <Link
              href="/recovery/tickets"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <MessagesSquare className="size-3.5" strokeWidth={1.8} />
              Open conversations
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <p className="font-mono-figures shrink-0 text-[12px] text-muted">
          {agent.runCount} recorded {agent.runCount === 1 ? "run" : "runs"}
        </p>
        {agent.runCount > 0 && (
          <div className="flex max-w-[220px] flex-1 items-center gap-2">
            <RatioBar value={agent.okRunCount / agent.runCount} className="bg-recovered" />
            <span className="font-mono-figures shrink-0 text-[11px] tabular-nums text-muted">
              {Math.round((agent.okRunCount / agent.runCount) * 100)}% ok
            </span>
          </div>
        )}
      </div>

      <div className="mt-3">
        <RunList agentId={agentId} runs={runs} />
      </div>
    </div>
  );
}
