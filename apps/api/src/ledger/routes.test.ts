import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { appendLedgerEntry } from "./append.js";
import { ledgerRoutes } from "./routes.js";

describe("GET /ledger/verify", () => {
  it("returns 200 { valid: true } for a healthy chain", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Ledger Route Test", email: `${randomUUID()}@example.com` },
    });
    await appendLedgerEntry({ merchantId: merchant.id, payload: { marker: randomUUID() } });

    const res = await ledgerRoutes.request("/ledger/verify");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true });
  });

  it("returns 409 with a JSON body — proves the bigint seq serialises without crashing", async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Ledger Route Test 2", email: `${randomUUID()}@example.com` },
    });
    const original = { marker: randomUUID() };
    const entry = await appendLedgerEntry({ merchantId: merchant.id, payload: original });
    await prisma.ledgerEntry.update({ where: { seq: entry.seq }, data: { payload: { tampered: true } } });

    const res = await ledgerRoutes.request("/ledger/verify");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { valid: boolean; brokenAtSeq: string };
    expect(body.valid).toBe(false);
    expect(body.brokenAtSeq).toBe(entry.seq.toString());

    // restore — this is the shared global chain, same reasoning as chain.test.ts
    await prisma.ledgerEntry.update({ where: { seq: entry.seq }, data: { payload: original } });
  });
});
