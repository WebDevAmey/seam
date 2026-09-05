import { prisma } from "../prisma.js";
import { appendLedgerEntry } from "../ledger/append.js";
import { classifyReply, type ReplyClass } from "./classify-reply.js";

// OPTOUT gets a ticket too — the system already handles it correctly (see
// below), but the founder should still see that it happened.
const NEEDS_TICKET: ReadonlySet<ReplyClass> = new Set(["REFUSE", "UNCLEAR", "OPTOUT"]);

export type HandleReplyResult = {
  replyClass: ReplyClass;
  ticketId: string | null;
};

/**
 * The inbound side of recovery messaging — simulated at the transport
 * layer (there's no real SMS/WhatsApp inbound webhook wired up, same
 * reason outbound is simulated: see LEARNINGS.md), but everything
 * downstream of "here is the reply text" is real: classification, ticket
 * creation, and — for OPTOUT — actually recording the opt-out so Shield's
 * check 1 blocks this customer going forward, not just logging that they
 * asked.
 */
export async function handleReply(input: {
  merchantId: string;
  recoveryActionId: string;
  customerPhone: string;
  text: string;
}): Promise<HandleReplyResult> {
  const replyClass = classifyReply(input.text);

  let ticketId: string | null = null;

  if (replyClass === "OPTOUT") {
    await prisma.optOut.upsert({
      where: { merchantId_phone: { merchantId: input.merchantId, phone: input.customerPhone } },
      create: { merchantId: input.merchantId, phone: input.customerPhone },
      update: {},
    });
  }

  if (NEEDS_TICKET.has(replyClass)) {
    const ticket = await prisma.ticket.create({
      data: {
        merchantId: input.merchantId,
        recoveryActionId: input.recoveryActionId,
        replyText: input.text,
        replyClass,
      },
    });
    ticketId = ticket.id;
  }

  await appendLedgerEntry({
    merchantId: input.merchantId,
    payload: {
      type: "reply_received",
      recoveryActionId: input.recoveryActionId,
      replyClass,
      ticketId,
    },
  });

  return { replyClass, ticketId };
}
