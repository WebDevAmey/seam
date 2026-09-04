const API_BASE_URL = process.env.SEAM_API_URL ?? "http://localhost:8090";

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

export type VerifyResult = { valid: true } | { valid: false; brokenAtSeq: string; reason: string };

// Server-side fetches only (Server Components) — this never runs in the
// browser, so there's no CORS surface to think about, and no API base URL
// gets shipped to the client bundle.
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
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
