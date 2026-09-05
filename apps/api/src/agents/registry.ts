export type AgentKind = "deterministic" | "llm-assisted";

export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  description: string;
  kind: AgentKind;
  /** The metric key `routes.ts` fills in from live per-merchant data —
   * matches a field on the `activity` object each route response carries. */
  activityKey: string;
};

/**
 * The single source of truth for every automated worker in Seam, in the
 * same spirit as a multi-agent registry: each entry is a bounded unit that
 * takes real data in and produces a real decision out, without a human in
 * the loop per run. Most are plain deterministic code, not an LLM — that's
 * disclosed here, not hidden behind "AI agent" branding neither this file
 * nor LIMITATIONS.md would back up. Diagnosis is the one genuinely
 * LLM-assisted step, and only for the ~25% of cases pattern-matching can't
 * already resolve (see classify-diagnosis.ts, LIMITATIONS.md §4).
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: "detector",
    name: "Leak Detector",
    role: "Detect",
    description:
      "Classifies every checkout into exactly one leak class: payment blocked, issuer downtime, silent abandon, or pre-checkout drop, from joined Shopify + Razorpay evidence. No model in this step.",
    kind: "deterministic",
    activityKey: "leaksDetected",
  },
  {
    id: "diagnosis",
    name: "Diagnosis Agent",
    role: "Diagnose",
    description:
      "Reads Razorpay's own decline fields to classify why a payment failed. About three-quarters of cases resolve by pattern-matching alone; the rest escalate to a schema-constrained, live LLM call (Groq, see src/llm/providers.ts).",
    kind: "llm-assisted",
    activityKey: "diagnosesRun",
  },
  {
    id: "opportunities",
    name: "Opportunities Agent",
    role: "Decide",
    description:
      "Runs the real Policy + Shield path as a dry run over every leak that hasn't been acted on yet, and reports what Seam would do: dispatch, hold for a human, or decline, ranked by predicted value. Never dispatches on its own.",
    kind: "deterministic",
    activityKey: "openOpportunities",
  },
  {
    id: "shield",
    name: "Shield",
    role: "Protect",
    description:
      "Seven ordered, fail-closed checks (opt-out, quiet hours, contact caps, an EV floor, message content) standing between any proposed action and a real customer. An exception inside Shield blocks, never passes. Its own run rechecks currently pending actions against live data.",
    kind: "deterministic",
    activityKey: "actionsBlocked",
  },
  {
    id: "recovery",
    name: "Recovery Executor",
    role: "Act",
    description:
      "Runs decide() and Shield over every unaddressed leak and reserves a real recovery action for each one that clears the bar, or records why it was blocked. Dispatching the message itself needs a merchant's connected Razorpay credentials, which this demo doesn't have.",
    kind: "deterministic",
    activityKey: "actionsDispatched",
  },
  {
    id: "intelligence",
    name: "Leak Intelligence",
    role: "Understand",
    description:
      "Watches each payment method's daily failure rate against its own 7-day baseline and flags a method-concentration leak the moment it spikes more than 2 standard deviations: often the first sign of an issuer- or gateway-side problem.",
    kind: "deterministic",
    activityKey: "methodConcentrationFindings",
  },
  {
    id: "conversations",
    name: "Conversation Agent",
    role: "Respond",
    description:
      "Classifies a customer's reply to a recovery message (promise, done, refuse, opt-out, unclear) and acts on it: opens a ticket for a human where one's needed, and writes a real opt-out that Shield checks on every future contact.",
    kind: "deterministic",
    activityKey: "openTickets",
  },
  {
    id: "digest",
    name: "Digest Agent",
    role: "Report",
    description:
      "Builds the founder-facing weekly brief from a merchant's own leak and recovery history for any period. Templated, not model-generated, and explicit about which figures are predicted EV versus realised.",
    kind: "deterministic",
    activityKey: "digestAvailable",
  },
  {
    id: "store_chat",
    name: "Store Chat Agent",
    role: "Converse",
    description:
      "A conversational assistant scoped to one merchant's own data: leaks, opportunities, open conversations, ledger integrity. Calls the same real, tested functions every other agent uses, as tools. Never authors a number itself and never takes an action; no send/dispatch tool is exposed to it, only read-only ones (src/agents/chat/tools.ts).",
    kind: "llm-assisted",
    activityKey: "chatThreads",
  },
];
