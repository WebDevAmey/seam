"use server";

import { analyzeIntelligence, runAgent } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

// Dependency order, not just a list: diagnosis reads leaks the detector
// just found; the recovery executor reads diagnoses when they exist;
// shield rechecks whatever the executor just reserved. Intelligence and
// opportunities are independent, so they run last as a status report on
// everything above. Digest, conversations, and store chat are
// on-demand/event-driven agents, not sweep-style batch work, so they're
// deliberately left out of this list.
const SWEEP_ORDER = ["detector", "diagnosis", "recovery", "shield", "opportunities"] as const;

export async function runAllAgentsAction() {
  const merchantId = await requireCurrentMerchantId();
  const results: Record<string, unknown> = {};

  for (const agentId of SWEEP_ORDER) {
    results[agentId] = await runAgent(merchantId, agentId);
  }
  results.intelligence = await analyzeIntelligence(merchantId);

  revalidatePath("/recovery/agents");
  revalidatePath("/recovery/map");
  revalidatePath("/recovery/queue");
  revalidatePath("/recovery/intelligence");
  revalidatePath("/recovery");

  return results;
}
