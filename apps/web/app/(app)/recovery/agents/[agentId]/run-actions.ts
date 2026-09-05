"use server";

import { getAgentRunDetail, runAgent, type AgentRunDetail, type TriggerableAgentId } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export async function getRunDetailAction(agentId: string, runId: string): Promise<AgentRunDetail> {
  const merchantId = await requireCurrentMerchantId();
  return getAgentRunDetail(merchantId, agentId, runId);
}

export async function runAgentNowAction(agentId: TriggerableAgentId) {
  const merchantId = await requireCurrentMerchantId();
  const result = await runAgent(merchantId, agentId);
  revalidatePath(`/recovery/agents/${agentId}`);
  revalidatePath("/recovery/agents");
  revalidatePath("/recovery/map");
  revalidatePath("/recovery/queue");
  return result;
}
