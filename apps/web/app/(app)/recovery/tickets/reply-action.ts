"use server";

import { revalidatePath } from "next/cache";
import { submitReply } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";

export async function submitReplyAction(input: {
  recoveryActionId: string;
  customerPhone: string;
  text: string;
}) {
  await requireCurrentMerchantId(); // redirects to /login if there's no session
  const result = await submitReply(input);
  revalidatePath("/recovery/tickets");
  return result;
}
