import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appendLedgerEntry } from "./append.js";
import { GENESIS_HASH } from "./hash-chain.js";
import { prisma } from "../prisma.js";
import { verifyLedgerChain } from "./verify.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Ledger Test", email: `${randomUUID()}@example.com` },
  });
}

describe("ledger — append + verify, against a real Postgres instance", () => {
  it("chains each new entry's prevHash to the immediately preceding entry's hash", async () => {
    const merchant = await seedMerchant();
    const first = await appendLedgerEntry({ merchantId: merchant.id, payload: { step: 1, marker: randomUUID() } });
    const second = await appendLedgerEntry({ merchantId: merchant.id, payload: { step: 2, marker: randomUUID() } });

    expect(second.prevHash).toBe(first.hash);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("starts from GENESIS_HASH when the table is genuinely empty", async () => {
    // Deliberately clears the whole table — this is currently the only test
    // file touching LedgerEntry, so it's safe. If a second one is ever
    // added, this needs to stop doing that (or move to its own DB/schema).
    await prisma.ledgerEntry.deleteMany();
    const merchant = await seedMerchant();
    const entry = await appendLedgerEntry({ merchantId: merchant.id, payload: { marker: randomUUID() } });
    expect(entry.prevHash).toBe(GENESIS_HASH);
  });

  it("verifies a real, untampered chain as valid", async () => {
    const merchant = await seedMerchant();
    await appendLedgerEntry({ merchantId: merchant.id, payload: { marker: randomUUID() } });
    await appendLedgerEntry({ merchantId: merchant.id, payload: { marker: randomUUID() } });
    await appendLedgerEntry({ merchantId: merchant.id, payload: { marker: randomUUID() } });

    const result = await verifyLedgerChain();
    expect(result.valid).toBe(true);
  });

  it("catches a tampered payload — the whole point of the chain", async () => {
    const merchant = await seedMerchant();
    const originalPayload = { action: "DELAYED_RETRY_LINK", evPaise: "5000" };
    const entry = await appendLedgerEntry({ merchantId: merchant.id, payload: originalPayload });

    // simulate someone editing history directly in the database — not
    // through appendLedgerEntry, which is the whole threat model here.
    await prisma.ledgerEntry.update({
      where: { seq: entry.seq },
      data: { payload: { action: "DELAYED_RETRY_LINK", evPaise: "999999" } },
    });

    const tampered = await verifyLedgerChain();
    expect(tampered.valid).toBe(false);
    if (!tampered.valid) {
      expect(tampered.brokenAtSeq).toBe(entry.seq);
    }

    // verifyLedgerChain reads the *whole* shared table, not just this
    // test's own rows — leaving the corruption in place would break every
    // later test's own verify() call too. Restore it.
    await prisma.ledgerEntry.update({ where: { seq: entry.seq }, data: { payload: originalPayload } });
    const restored = await verifyLedgerChain();
    expect(restored.valid).toBe(true);
  });

  it("never forks under concurrent writes — 10 simultaneous appends still form one straight line", async () => {
    const merchant = await seedMerchant();
    const before = await prisma.ledgerEntry.count();

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        appendLedgerEntry({ merchantId: merchant.id, payload: { concurrent: i, marker: randomUUID() } }),
      ),
    );

    const after = await prisma.ledgerEntry.count();
    expect(after - before).toBe(10);

    const result = await verifyLedgerChain();
    expect(result.valid).toBe(true);
  });
});
