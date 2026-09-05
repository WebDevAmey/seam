import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../prisma.js";
import { verifyLedgerChain } from "../ledger/verify.js";
import { handleReply } from "./handle-reply.js";

async function seedMerchant() {
  return prisma.merchant.create({
    data: { name: "Reply Test", email: `${randomUUID()}@example.com` },
  });
}

describe("handleReply — the inbound side, made real downstream of a simulated transport", () => {
  it("a PROMISE reply: no ticket, ledger records the reply", async () => {
    const merchant = await seedMerchant();

    const result = await handleReply({
      merchantId: merchant.id,
      recoveryActionId: "ra_1",
      customerPhone: "+919876543210",
      text: "will pay in a bit",
    });

    expect(result.replyClass).toBe("PROMISE");
    expect(result.ticketId).toBeNull();
    const ticketCount = await prisma.ticket.count({ where: { merchantId: merchant.id } });
    expect(ticketCount).toBe(0);

    const chain = await verifyLedgerChain();
    expect(chain.valid).toBe(true);
    const entry = await prisma.ledgerEntry.findFirst({ where: { merchantId: merchant.id }, orderBy: { seq: "desc" } });
    expect((entry?.payload as { type: string }).type).toBe("reply_received");
  });

  it("a DONE reply: no ticket either — a positive signal, not a human's problem", async () => {
    const merchant = await seedMerchant();

    const result = await handleReply({
      merchantId: merchant.id,
      recoveryActionId: "ra_1",
      customerPhone: "+919876543210",
      text: "already paid",
    });

    expect(result.replyClass).toBe("DONE");
    expect(result.ticketId).toBeNull();
  });

  it("a REFUSE reply: creates an OPEN ticket for a human", async () => {
    const merchant = await seedMerchant();

    const result = await handleReply({
      merchantId: merchant.id,
      recoveryActionId: "ra_1",
      customerPhone: "+919876543210",
      text: "not interested, cancel it",
    });

    expect(result.replyClass).toBe("REFUSE");
    expect(result.ticketId).toBeTruthy();
    const ticket = await prisma.ticket.findUnique({ where: { id: result.ticketId! } });
    expect(ticket?.status).toBe("OPEN");
    expect(ticket?.replyText).toBe("not interested, cancel it");
  });

  it("an UNCLEAR reply: also creates a ticket rather than guessing", async () => {
    const merchant = await seedMerchant();

    const result = await handleReply({
      merchantId: merchant.id,
      recoveryActionId: "ra_1",
      customerPhone: "+919876543210",
      text: "what is this",
    });

    expect(result.replyClass).toBe("UNCLEAR");
    expect(result.ticketId).toBeTruthy();
  });

  it("an OPTOUT reply: creates a ticket AND records the opt-out so Shield actually blocks future contact", async () => {
    const merchant = await seedMerchant();
    const phone = "+919876500000";

    const result = await handleReply({
      merchantId: merchant.id,
      recoveryActionId: "ra_1",
      customerPhone: phone,
      text: "STOP",
    });

    expect(result.replyClass).toBe("OPTOUT");
    expect(result.ticketId).toBeTruthy();

    const optOut = await prisma.optOut.findUnique({
      where: { merchantId_phone: { merchantId: merchant.id, phone } },
    });
    expect(optOut).not.toBeNull();
  });

  it("a second OPTOUT from the same customer is idempotent — upsert, not a duplicate-key crash", async () => {
    const merchant = await seedMerchant();
    const phone = "+919876500001";

    await handleReply({ merchantId: merchant.id, recoveryActionId: "ra_1", customerPhone: phone, text: "stop" });
    await handleReply({ merchantId: merchant.id, recoveryActionId: "ra_2", customerPhone: phone, text: "unsubscribe" });

    const count = await prisma.optOut.count({ where: { merchantId: merchant.id, phone } });
    expect(count).toBe(1);
  });
});
