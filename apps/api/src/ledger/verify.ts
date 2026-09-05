import { prisma } from "../prisma.js";
import { computeEntryHash, GENESIS_HASH } from "./hash-chain.js";

export type VerifyResult =
  | { valid: true; totalEntries: number; merchantsAffected: number; firstSeq: string; lastSeq: string; elapsedMs: number }
  | { valid: false; brokenAtSeq: bigint; reason: string; totalEntries: number; merchantsAffected: number; firstSeq: string; lastSeq: string; elapsedMs: number };

/** Recomputes the entire chain from genesis — the actual "verify" button
 * behind screen 3. Every entry's prevHash must match the entry before it,
 * and every entry's hash must be exactly what its own prevHash+payload
 * recompute to. */
export async function verifyLedgerChain(): Promise<VerifyResult> {
  const t0 = performance.now();
  const entries = await prisma.ledgerEntry.findMany({ orderBy: { seq: "asc" } });
  const merchantsAffected = new Set(entries.map((e) => e.merchantId)).size;
  const first = entries[0];
  const last = entries[entries.length - 1];
  const firstSeq = first ? first.seq.toString() : "0";
  const lastSeq = last ? last.seq.toString() : "0";

  let expectedPrevHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtSeq: entry.seq,
        reason: "prevHash doesn't match the prior entry's hash",
        totalEntries: entries.length,
        merchantsAffected,
        firstSeq,
        lastSeq,
        elapsedMs: performance.now() - t0,
      };
    }
    const recomputed = computeEntryHash(entry.prevHash, entry.payload);
    if (recomputed !== entry.hash) {
      return {
        valid: false,
        brokenAtSeq: entry.seq,
        reason: "stored hash doesn't match the recomputed one",
        totalEntries: entries.length,
        merchantsAffected,
        firstSeq,
        lastSeq,
        elapsedMs: performance.now() - t0,
      };
    }
    expectedPrevHash = entry.hash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    merchantsAffected,
    firstSeq,
    lastSeq,
    elapsedMs: performance.now() - t0,
  };
}
