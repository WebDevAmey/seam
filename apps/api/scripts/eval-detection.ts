/**
 * Leak detection precision/recall, per class, against the generator's own
 * ground truth. `pnpm exec tsx scripts/eval-detection.ts dev` or `heldout`
 * — the held-out set is meant to be run exactly once (PRD §10); this script
 * doesn't enforce that, the discipline of only invoking it with `heldout`
 * one time does.
 */
import { randomUUID } from "node:crypto";
import { generateMerchantDay } from "../src/generator/generate-merchant-day.js";
import { detectLeaksForMerchant } from "../src/leaks/detect-for-merchant.js";
import { prisma } from "../src/prisma.js";

const SEEDS: Record<string, number> = { dev: 100, heldout: 900_101 };
const CLASSES = ["PAYMENT_BLOCKED", "ISSUER_DOWNTIME", "SILENT_ABANDON", "PRE_CHECKOUT_DROP"] as const;

type ClassStats = { tp: number; fp: number; fn: number };

async function main() {
  const setName = process.argv[2] ?? "dev";
  const seed = SEEDS[setName];
  if (!seed) {
    throw new Error(`unknown set "${setName}" — use "dev" or "heldout"`);
  }

  const merchant = await prisma.merchant.create({
    data: { name: `eval-detection-${setName}`, email: `eval-detection-${setName}-${seed}-${randomUUID()}@example.com` },
  });

  const { groundTruth } = await generateMerchantDay({
    merchantId: merchant.id,
    seed,
    counts: { clean: 30, paymentBlocked: 12, issuerDowntime: 6, silentAbandon: 15, preCheckoutDrop: 10 },
  });

  await detectLeaksForMerchant(merchant.id);
  const detected = await prisma.leak.findMany({ where: { merchantId: merchant.id } });

  const truthByCheckout = new Map(groundTruth.map((g) => [g.checkoutId, g.class]));
  const detectedByCheckout = new Map(detected.map((d) => [d.checkoutId!, d.class]));

  const stats = new Map<string, ClassStats>(CLASSES.map((c) => [c, { tp: 0, fp: 0, fn: 0 }]));
  const allCheckoutIds = new Set([...truthByCheckout.keys(), ...detectedByCheckout.keys()]);

  for (const checkoutId of allCheckoutIds) {
    const truth = truthByCheckout.get(checkoutId);
    const pred = detectedByCheckout.get(checkoutId);
    if (truth && pred && truth === pred) {
      stats.get(truth)!.tp++;
    } else {
      if (pred && stats.has(pred)) stats.get(pred)!.fp++;
      if (truth && stats.has(truth)) stats.get(truth)!.fn++;
    }
  }

  console.log(`\n=== Detection eval — ${setName} (seed ${seed}) ===`);
  console.log(`ground truth: ${groundTruth.length} leaks planted, ${detected.length} leaks detected\n`);
  for (const c of CLASSES) {
    const { tp, fp, fn } = stats.get(c)!;
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    console.log(
      `${c.padEnd(20)} tp=${tp} fp=${fp} fn=${fn}  precision=${precision === null ? "n/a" : precision.toFixed(3)}  recall=${recall === null ? "n/a" : recall.toFixed(3)}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
