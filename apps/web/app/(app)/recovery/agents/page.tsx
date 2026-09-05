import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  ShieldCheck,
  Send,
  TrendingUp,
  MessageSquare,
  Link2,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { getAgents, getOpportunities } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise, leakClassLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { FeatureCard } from "@/components/ui/grid-feature-cards";
import { RatioBar } from "@/components/ui/ratio-bar";
import { RunAllButton } from "./run-all-button";

const AGENT_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  detector: AlertTriangle,
  diagnosis: Bot,
  opportunities: Sparkles,
  shield: ShieldCheck,
  recovery: Send,
  intelligence: TrendingUp,
  conversations: MessageSquare,
  digest: Newspaper,
  store_chat: MessageSquare,
};

const ACTIVITY_LABEL: Record<string, string> = {
  leaksDetected: "leaks detected",
  diagnosesRun: "diagnoses run",
  openOpportunities: "open opportunities",
  actionsBlocked: "actions blocked",
  actionsDispatched: "actions dispatched",
  methodConcentrationFindings: "concentration findings",
  openTickets: "open conversations",
  digestAvailable: "always on",
  chatThreads: "conversations started",
};

const VERDICT_LABEL: Record<string, string> = {
  would_dispatch: "Would dispatch",
  would_hold_for_approval: "Would hold for approval",
  no_action: "No action",
};

export default async function AgentsPage() {
  const merchantId = await requireCurrentMerchantId();
  const [agents, opportunities] = await Promise.all([getAgents(merchantId), getOpportunities(merchantId)]);

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[20px] font-semibold text-ink">Agent fleet</h1>
          <p className="mt-1 max-w-[68ch] text-[13px] text-muted">
            Every automated worker in Seam, named for what it actually does. Most run on plain code, not
            a model. We show it that way instead of calling everything an &ldquo;AI agent.&rdquo;
          </p>
        </div>
        <RunAllButton />
      </div>
      <p className="mt-3 max-w-[68ch] text-[12px] text-muted">
        Runs the detector, diagnosis, the recovery executor, shield, intelligence, and opportunities in
        that order, so each one has what it needs from the last. Digest, conversations, and chat are
        on-demand, not sweep-style, so they&rsquo;re triggered from their own pages instead.
      </p>

      <div className="mt-6 grid grid-cols-1 divide-x divide-y divide-dashed border border-dashed border-rule sm:grid-cols-2 md:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/recovery/agents/${agent.id}`} className="group relative block transition-colors hover:bg-primary-tint/40">
            <FeatureCard
              feature={{
                title: agent.name,
                description: agent.description,
                icon: AGENT_ICON[agent.id] ?? Bot,
              }}
            />
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
              <Badge tone={agent.kind === "llm-assisted" ? "pending" : "neutral"}>
                {agent.kind === "llm-assisted" ? "LLM" : "Code"}
              </Badge>
            </div>
            <div className="border-t border-dashed border-rule px-6 py-3">
              <div className="flex items-center justify-between">
                <p className="font-mono-figures text-[11px] text-muted">
                  <span className="font-semibold text-ink">{agent.activityCount}</span>{" "}
                  {ACTIVITY_LABEL[agent.activityKey] ?? agent.activityKey}
                </p>
                <p className="font-mono-figures text-[11px] text-muted transition-colors group-hover:text-primary">
                  {agent.runCount} {agent.runCount === 1 ? "run" : "runs"} →
                </p>
              </div>
              {agent.runCount > 0 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <RatioBar value={agent.okRunCount / agent.runCount} className="bg-recovered" />
                  <span className="font-mono-figures shrink-0 text-[10.5px] tabular-nums text-muted">
                    {Math.round((agent.okRunCount / agent.runCount) * 100)}% ok
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-heading text-[16px] font-semibold text-ink">Opportunities right now</h2>
        <p className="mt-1 max-w-[68ch] text-[13px] text-muted">
          A live test run of Policy and Shield over every leak that hasn&apos;t been acted on yet. Real
          computation, no made-up numbers, nothing actually sent.
        </p>

        <div className="mt-4 border-t border-rule">
          {opportunities.length === 0 && (
            <p className="border-b border-rule py-6 text-[13px] text-muted">
              No unaddressed actionable leaks right now.
            </p>
          )}
          {opportunities.map((opp) => (
            <div key={opp.leakId} className="flex items-center justify-between gap-4 border-b border-rule py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{leakClassLabel(opp.leakClass)}</span>
                  <span className="font-mono-figures text-[11px] text-muted">{opp.diagnosisClass}</span>
                </div>
                {opp.reason && <p className="mt-0.5 truncate text-[12px] text-muted">{opp.reason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="font-mono-figures text-[13px] tabular-nums text-muted">
                  {formatPaise(opp.amountPaise)}
                </span>
                <Badge
                  tone={
                    opp.verdict === "would_dispatch" ? "recovered" : opp.verdict === "would_hold_for_approval" ? "pending" : "neutral"
                  }
                >
                  {VERDICT_LABEL[opp.verdict]}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
