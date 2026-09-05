import { cookies } from "next/headers";

const API_BASE_URL = process.env.SEAM_API_URL ?? "http://localhost:8090";

// apps/api's /merchants/:id/... routes now verify the caller's session
// instead of trusting whatever id is in the URL (see LIMITATIONS.md §6) —
// so every fetch that names a merchant has to carry that merchant's own
// session token, forwarded from the same httpOnly cookie apps/web's own
// middleware already verifies.
async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get("auth-token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type Leak = {
  id: string;
  class: string;
  amountPaise: string;
  checkoutId: string | null;
  evidenceEventIds: string[];
  confidence: string;
  detectedAt: string;
};

export type RecoveryAction = {
  id: string;
  checkoutId: string;
  leakId: string;
  actionClass: string;
  state: string;
  evPaise: string;
  shieldVerdict: string;
  shieldReason: string | null;
  rzpRef: string | null;
  createdAt: string;
  dispatchedAt: string | null;
};

export type LedgerEntry = {
  seq: string;
  merchantId: string;
  prevHash: string;
  hash: string;
  payload: unknown;
  createdAt: string;
};

export type VerifyResult =
  | { valid: true; totalEntries: number; merchantsAffected: number; firstSeq: string; lastSeq: string; elapsedMs: number }
  | { valid: false; brokenAtSeq: string; reason: string; totalEntries: number; merchantsAffected: number; firstSeq: string; lastSeq: string; elapsedMs: number };

export type MethodConcentrationFinding = {
  method: string;
  currentRate: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  sampleSize: number;
};

export type Digest = {
  periodStart: string;
  periodEnd: string;
  leaksDetected: number;
  leaksByClass: { class: string; count: number; amountPaise: string }[];
  totalLeakAmountPaise: string;
  actionsDispatched: number;
  actionsBlocked: number;
  netRecoveredPaise: string;
  potentialRecoveryPaise: string;
  actionsReserved: number;
  shieldBlockReasons: { reason: string; count: number }[];
  narrative: string;
};

export type AnalyticsSummary = {
  dailySeries: { date: string; leakAmountPaise: string; leaksCount: number; recoveredPaise: string }[];
  byClass: { class: string; count: number; amountPaise: string }[];
  byMethod: { method: string; attempts: number; failures: number }[];
  funnel: { leaksDetected: number; dispatched: number; blocked: number; needsApproval: number };
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  kind: "deterministic" | "llm-assisted";
  activityKey: string;
  activityCount: number;
  runCount: number;
  okRunCount: number;
};

export type AgentRunSummary = {
  id: string;
  status: "ok" | "error";
  summary: string;
  durationMs: number;
  startedAt: string;
};

export type AgentRunDetail = AgentRunSummary & {
  agentId: string;
  merchantId: string;
  input: unknown;
  output: unknown;
  error: string | null;
};

export type ChatToolCall = { toolName: string; input: unknown; output: unknown };

export type ChatThread = { id: string; merchantId: string; title: string | null; createdAt: string };

export type ChatMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls: ChatToolCall[] | null;
  createdAt: string;
};

export type Opportunity = {
  leakId: string;
  checkoutId: string;
  leakClass: string;
  amountPaise: string;
  diagnosisClass: string;
  verdict: "would_dispatch" | "would_hold_for_approval" | "no_action";
  reason: string | null;
  actionClass: string | null;
  evPaise: string | null;
};

export type Ticket = {
  id: string;
  merchantId: string;
  recoveryActionId: string;
  replyText: string;
  replyClass: string;
  status: string;
  createdAt: string;
};

// Server-side fetches only (Server Components) — this never runs in the
// browser, so there's no CORS surface to think about, and no API base URL
// gets shipped to the client bundle.
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: await authHeader() });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getLeaks(merchantId: string): Promise<Leak[]> {
  return apiFetch(`/merchants/${merchantId}/leaks`);
}

export function getRecoveryActions(merchantId: string): Promise<RecoveryAction[]> {
  return apiFetch(`/merchants/${merchantId}/recovery-actions`);
}

export function getLedgerEntries(merchantId?: string): Promise<LedgerEntry[]> {
  return apiFetch(`/ledger${merchantId ? `?merchantId=${merchantId}` : ""}`);
}

export async function verifyLedger(): Promise<VerifyResult> {
  // Unlike every other endpoint here, a non-2xx (409) is a legitimate,
  // meaningful answer for this one — "the chain is broken, here's where" —
  // not a fetch failure. apiFetch's throw-on-!ok would swallow that.
  const res = await fetch(`${API_BASE_URL}/ledger/verify`, { cache: "no-store" });
  return res.json() as Promise<VerifyResult>;
}

export function getDigest(merchantId: string, period?: { start: Date; end: Date }): Promise<Digest> {
  const query = period ? `?start=${period.start.toISOString()}&end=${period.end.toISOString()}` : "";
  return apiFetch(`/merchants/${merchantId}/digest${query}`);
}

export function getTickets(merchantId: string): Promise<Ticket[]> {
  return apiFetch(`/merchants/${merchantId}/tickets`);
}

export function getAnalyticsSummary(merchantId: string, days = 14): Promise<AnalyticsSummary> {
  return apiFetch(`/merchants/${merchantId}/analytics/summary?days=${days}`);
}

export function getAgents(merchantId: string): Promise<Agent[]> {
  return apiFetch(`/merchants/${merchantId}/agents`);
}

export function getOpportunities(merchantId: string): Promise<Opportunity[]> {
  return apiFetch(`/merchants/${merchantId}/agents/opportunities`);
}

export function getAgentRuns(merchantId: string, agentId: string): Promise<AgentRunSummary[]> {
  return apiFetch(`/merchants/${merchantId}/agents/${agentId}/runs`);
}

export function getAgentRunDetail(merchantId: string, agentId: string, runId: string): Promise<AgentRunDetail> {
  return apiFetch(`/merchants/${merchantId}/agents/${agentId}/runs/${runId}`);
}

export type TriggerableAgentId = "opportunities" | "detector" | "diagnosis" | "recovery" | "shield";

export async function runAgent(merchantId: string, agentId: TriggerableAgentId): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/merchants/${merchantId}/agents/${agentId}/run`, {
    method: "POST",
    cache: "no-store",
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`agent run failed: ${res.status}`);
  return res.json();
}

export function getChatThreads(merchantId: string): Promise<ChatThread[]> {
  return apiFetch(`/merchants/${merchantId}/chat/threads`);
}

export function getChatThread(merchantId: string, threadId: string): Promise<{ thread: ChatThread; messages: ChatMessage[] }> {
  return apiFetch(`/merchants/${merchantId}/chat/threads/${threadId}`);
}

export async function sendChatMessage(
  merchantId: string,
  threadId: string | null,
  message: string,
): Promise<{ threadId: string; reply: string; toolCalls: ChatToolCall[] } | { error: string }> {
  const res = await fetch(`${API_BASE_URL}/merchants/${merchantId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ threadId, message }),
    cache: "no-store",
  });
  return res.json();
}

export async function analyzeIntelligence(
  merchantId: string,
): Promise<{ today: string; findings: MethodConcentrationFinding[]; leaksCreated: number }> {
  const res = await fetch(`${API_BASE_URL}/merchants/${merchantId}/intelligence/analyze`, {
    method: "POST",
    cache: "no-store",
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`intelligence analyze failed: ${res.status}`);
  return res.json();
}

export async function submitReply(input: {
  recoveryActionId: string;
  customerPhone: string;
  text: string;
}): Promise<{ replyClass: string; ticketId: string | null } | { error: string }> {
  const res = await fetch(`${API_BASE_URL}/recovery-actions/${input.recoveryActionId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ customerPhone: input.customerPhone, text: input.text }),
    cache: "no-store",
  });
  return res.json();
}

export async function approveRecoveryAction(recoveryActionId: string): Promise<{ outcome: string } | { error: string }> {
  const res = await fetch(`${API_BASE_URL}/recovery-actions/${recoveryActionId}/approve`, {
    method: "POST",
    headers: await authHeader(),
    cache: "no-store",
  });
  return res.json();
}

export async function rejectRecoveryAction(recoveryActionId: string, reason?: string): Promise<{ outcome: string } | { error: string }> {
  const res = await fetch(`${API_BASE_URL}/recovery-actions/${recoveryActionId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ reason }),
    cache: "no-store",
  });
  return res.json();
}
