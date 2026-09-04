/**
 * Seeds one demo merchant with generated data (leaks, a recovery action,
 * a ledger entry) so the frontend has honest, real rows to render during
 * development — not a fabricated screenshot, actual data that went through
 * the actual generator, detector, and execution code.
 */
import { generateMerchantDay } from "../src/generator/generate-merchant-day.js";
import { detectLeaksForMerchant } from "../src/leaks/detect-for-merchant.js";
import { prisma } from "../src/prisma.js";
import { appendLedgerEntry } from "../src/ledger/append.js";

async function main() {
  const merchant = await prisma.merchant.create({
    data: { name: "Kolam & Co.", email: "founder@kolamandco.example" },
  });

  await generateMerchantDay({
    merchantId: merchant.id,
    seed: 42,
    counts: { clean: 14, paymentBlocked: 5, issuerDowntime: 3, silentAbandon: 6, preCheckoutDrop: 4 },
  });

  await detectLeaksForMerchant(merchant.id);

  const leaks = await prisma.leak.findMany({ where: { merchantId: merchant.id } });
  const blockedLeak = leaks.find((l) => l.class === "PAYMENT_BLOCKED");
  if (blockedLeak) {
    const action = await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: blockedLeak.checkoutId!,
        leakId: blockedLeak.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "DISPATCHED",
        idempotencyKey: `${merchant.id}:${blockedLeak.checkoutId}:ALTERNATE_METHOD_LINK`,
        evPaise: 8200n,
        shieldVerdict: "PASS",
        rzpRef: "plink_demo_1",
        dispatchedAt: new Date(),
      },
    });
    await appendLedgerEntry({
      merchantId: merchant.id,
      payload: {
        type: "action_dispatched",
        actionId: action.id,
        leakId: blockedLeak.id,
        checkoutId: blockedLeak.checkoutId,
        actionClass: "ALTERNATE_METHOD_LINK",
        channel: "sms",
      },
    });
  }

  const blockedAtFloor = leaks.find((l) => l.class === "SILENT_ABANDON");
  if (blockedAtFloor) {
    await prisma.recoveryAction.create({
      data: {
        merchantId: merchant.id,
        checkoutId: blockedAtFloor.checkoutId!,
        leakId: blockedAtFloor.id,
        actionClass: "ALTERNATE_METHOD_LINK",
        state: "FAILED",
        idempotencyKey: `${merchant.id}:${blockedAtFloor.checkoutId}:BLOCKED_DEMO`,
        evPaise: 100n,
        shieldVerdict: "BLOCK",
        shieldReason: "amount below the ₹200 recovery floor",
      },
    });
    await appendLedgerEntry({
      merchantId: merchant.id,
      payload: {
        type: "action_blocked",
        leakId: blockedAtFloor.id,
        checkoutId: blockedAtFloor.checkoutId,
        actionClass: "ALTERNATE_METHOD_LINK",
        reason: "amount below the ₹200 recovery floor",
      },
    });
  }

  console.log(`Seeded demo merchant: ${merchant.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
