import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { computeEntryHash, GENESIS_HASH } from "./hash-chain.js";

// Fixed key for a Postgres advisory lock — the whole chain is one global
// sequence across every merchant (screen 3 filters by merchant for display;
// the chain itself doesn't branch per merchant). An advisory lock is what
// makes concurrent appends safe even for the very first entry, where a
// row-level `SELECT ... FOR UPDATE` would have nothing to lock yet.
const LEDGER_LOCK_KEY = 727_272;

export async function appendLedgerEntry(input: {
  merchantId: string;
  payload: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LEDGER_LOCK_KEY})`;

    const last = await tx.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const hash = computeEntryHash(prevHash, input.payload);

    return tx.ledgerEntry.create({
      data: {
        merchantId: input.merchantId,
        prevHash,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        hash,
      },
    });
  });
}
