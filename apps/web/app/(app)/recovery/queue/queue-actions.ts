"use server";

import { approveRecoveryAction, rejectRecoveryAction } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function approveAction(recoveryActionId: string) {
  const result = await approveRecoveryAction(recoveryActionId);
  revalidatePath("/recovery/queue");
  return result;
}

export async function rejectAction(recoveryActionId: string, reason?: string) {
  const result = await rejectRecoveryAction(recoveryActionId, reason);
  revalidatePath("/recovery/queue");
  return result;
}
