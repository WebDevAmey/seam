import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { createRng, pick, randomInt } from "./rng.js";

/**
 * The four leak classes (PRD §5) expressible with today's schema. Deferred:
 * METHOD_CONCENTRATION (needs a 14-day baseline, not one merchant-day) and
 * POST_PURCHASE_LEAK (needs a refund/return model that doesn't exist yet).
 */
export type LeakClass = "PAYMENT_BLOCKED" | "ISSUER_DOWNTIME" | "SILENT_ABANDON" | "PRE_CHECKOUT_DROP";

export type GroundTruthLeak = {
  checkoutId: string;
  class: LeakClass;
  amountPaise: bigint;
};

export type GeneratedMerchantDay = {
  merchantId: string;
  groundTruth: GroundTruthLeak[];
};

export type GenerateCounts = {
  clean: number;
  paymentBlocked: number;
  issuerDowntime: number;
  silentAbandon: number;
  preCheckoutDrop: number;
};

const DEFAULT_COUNTS: GenerateCounts = {
  clean: 20,
  paymentBlocked: 6,
  issuerDowntime: 3,
  silentAbandon: 8,
  preCheckoutDrop: 10,
};

const METHODS = ["card", "upi", "netbanking", "wallet"] as const;
const FIRST_NAMES = ["asha", "rahul", "priya", "vikram", "neha", "arjun", "kavya", "rohan", "meera", "sanjay"];

function randomAmountPaise(rng: () => number): bigint {
  return BigInt(randomInt(rng, 300, 5000) * 100);
}

function randomCustomer(rng: () => number, index: number): { email: string; phone: string } {
  return {
    email: `${pick(rng, FIRST_NAMES)}${index}@example.com`,
    phone: `+91${randomInt(rng, 7_000_000_000, 9_999_999_999)}`,
  };
}

async function createFunnelEvent(opts: {
  merchantId: string;
  checkoutId: string;
  stage: string;
  email: string;
  phone: string;
  amountPaise: bigint;
  occurredAt: Date;
}) {
  await prisma.funnelEvent.create({
    data: {
      merchantId: opts.merchantId,
      checkoutId: opts.checkoutId,
      customerRef: `synthetic:${opts.checkoutId}`,
      customerEmail: opts.email,
      customerPhone: opts.phone,
      stage: opts.stage,
      occurredAt: opts.occurredAt,
      amountPaise: opts.amountPaise,
      rawEventId: `synthetic:${randomUUID()}`,
    },
  });
}

async function createPaymentAttempt(opts: {
  merchantId: string;
  checkoutId: string;
  method: string;
  status: string;
  amountPaise: bigint;
  attemptedAt: Date;
  errorReason?: string;
}) {
  await prisma.paymentAttempt.create({
    data: {
      merchantId: opts.merchantId,
      rzpPaymentId: `pay_synthetic_${randomUUID()}`,
      rzpOrderId: `order_synthetic_${randomUUID()}`,
      checkoutId: opts.checkoutId,
      // "notes": the generator knows the true checkout↔payment link because
      // it created both sides together — that's the same certainty a real
      // notes-stamped join gives, not a claim about a real webhook payload.
      joinConfidence: 1,
      joinMethod: "notes",
      method: opts.method,
      status: opts.status,
      amountPaise: opts.amountPaise,
      attemptedAt: opts.attemptedAt,
      errorReason: opts.errorReason ?? null,
    },
  });
}

/**
 * Produces one merchant-day of realistic, labelled data: clean purchases
 * plus each of the four leak classes above, with a ground-truth manifest
 * the eval harness can score detector output against. Deterministic given
 * a seed — call it twice with different seeds for the dev/held-out split
 * (PRD §10: open the held-out set exactly once).
 */
export async function generateMerchantDay(options: {
  merchantId: string;
  seed: number;
  date?: Date;
  counts?: Partial<GenerateCounts>;
}): Promise<GeneratedMerchantDay> {
  const rng = createRng(options.seed);
  const date = options.date ?? new Date();
  const counts = { ...DEFAULT_COUNTS, ...options.counts };
  const groundTruth: GroundTruthLeak[] = [];
  let index = 0;

  let downtimeWindow: { startedAt: Date; resolvedAt: Date; method: string } | null = null;
  if (counts.issuerDowntime > 0) {
    const startedAt = new Date(date.getTime() + 4 * 3_600_000);
    const resolvedAt = new Date(startedAt.getTime() + 2 * 3_600_000);
    const method = "upi";
    await prisma.downtimeWindow.create({
      data: { method, issuer: "HDFC", severity: "high", startedAt, resolvedAt },
    });
    downtimeWindow = { startedAt, resolvedAt, method };
  }

  for (let i = 0; i < counts.clean; i++, index++) {
    const checkoutId = `checkout_clean_${options.seed}_${index}`;
    const { email, phone } = randomCustomer(rng, index);
    const amountPaise = randomAmountPaise(rng);
    const occurredAt = new Date(date.getTime() + randomInt(rng, 0, 20) * 3_600_000);
    await createFunnelEvent({
      merchantId: options.merchantId,
      checkoutId,
      stage: "checkout_start",
      email,
      phone,
      amountPaise,
      occurredAt,
    });
    await createPaymentAttempt({
      merchantId: options.merchantId,
      checkoutId,
      method: pick(rng, METHODS),
      status: "captured",
      amountPaise,
      attemptedAt: new Date(occurredAt.getTime() + 60_000),
    });
  }

  for (let i = 0; i < counts.paymentBlocked; i++, index++) {
    const checkoutId = `checkout_blocked_${options.seed}_${index}`;
    const { email, phone } = randomCustomer(rng, index);
    const amountPaise = randomAmountPaise(rng);
    const occurredAt = new Date(date.getTime() + randomInt(rng, 0, 20) * 3_600_000);
    await createFunnelEvent({
      merchantId: options.merchantId,
      checkoutId,
      stage: "checkout_start",
      email,
      phone,
      amountPaise,
      occurredAt,
    });
    await createPaymentAttempt({
      merchantId: options.merchantId,
      checkoutId,
      method: pick(rng, METHODS),
      status: "failed",
      amountPaise,
      attemptedAt: new Date(occurredAt.getTime() + 60_000),
      errorReason: "payment_failed",
    });
    groundTruth.push({ checkoutId, class: "PAYMENT_BLOCKED", amountPaise });
  }

  for (let i = 0; i < counts.issuerDowntime; i++, index++) {
    if (!downtimeWindow) break;
    const checkoutId = `checkout_downtime_${options.seed}_${index}`;
    const { email, phone } = randomCustomer(rng, index);
    const amountPaise = randomAmountPaise(rng);
    const windowSpanMs = downtimeWindow.resolvedAt.getTime() - downtimeWindow.startedAt.getTime();
    const attemptedAt = new Date(downtimeWindow.startedAt.getTime() + randomInt(rng, 0, windowSpanMs));
    const occurredAt = new Date(attemptedAt.getTime() - 60_000);
    await createFunnelEvent({
      merchantId: options.merchantId,
      checkoutId,
      stage: "checkout_start",
      email,
      phone,
      amountPaise,
      occurredAt,
    });
    await createPaymentAttempt({
      merchantId: options.merchantId,
      checkoutId,
      method: downtimeWindow.method,
      status: "failed",
      amountPaise,
      attemptedAt,
      errorReason: "gateway_error",
    });
    groundTruth.push({ checkoutId, class: "ISSUER_DOWNTIME", amountPaise });
  }

  for (let i = 0; i < counts.silentAbandon; i++, index++) {
    const checkoutId = `checkout_abandon_${options.seed}_${index}`;
    const { email, phone } = randomCustomer(rng, index);
    const amountPaise = randomAmountPaise(rng);
    const occurredAt = new Date(date.getTime() + randomInt(rng, 0, 20) * 3_600_000);
    await createFunnelEvent({
      merchantId: options.merchantId,
      checkoutId,
      stage: "checkout_start",
      email,
      phone,
      amountPaise,
      occurredAt,
    });
    groundTruth.push({ checkoutId, class: "SILENT_ABANDON", amountPaise });
  }

  for (let i = 0; i < counts.preCheckoutDrop; i++, index++) {
    const checkoutId = `checkout_precart_${options.seed}_${index}`;
    const { email, phone } = randomCustomer(rng, index);
    const amountPaise = randomAmountPaise(rng);
    const occurredAt = new Date(date.getTime() + randomInt(rng, 0, 20) * 3_600_000);
    await createFunnelEvent({
      merchantId: options.merchantId,
      checkoutId,
      stage: "add_to_cart",
      email,
      phone,
      amountPaise,
      occurredAt,
    });
    groundTruth.push({ checkoutId, class: "PRE_CHECKOUT_DROP", amountPaise });
  }

  return { merchantId: options.merchantId, groundTruth };
}
