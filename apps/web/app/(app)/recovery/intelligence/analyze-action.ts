"use server";

import { revalidatePath } from "next/cache";
import { analyzeIntelligence } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";

export async function runAnalysisAction() {
  const merchantId = await requireCurrentMerchantId();
  const result = await analyzeIntelligence(merchantId);
  revalidatePath("/recovery/intelligence");
  return result;
}
