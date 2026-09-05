"use server";

import { sendChatMessage, getChatThread, type ChatMessage, type ChatToolCall } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export async function sendMessageAction(
  threadId: string | null,
  message: string,
): Promise<{ threadId: string; reply: string; toolCalls: ChatToolCall[] } | { error: string }> {
  const merchantId = await requireCurrentMerchantId();
  const result = await sendChatMessage(merchantId, threadId, message);
  revalidatePath("/recovery/chat");
  return result;
}

export async function loadThreadAction(threadId: string): Promise<ChatMessage[]> {
  const merchantId = await requireCurrentMerchantId();
  const { messages } = await getChatThread(merchantId, threadId);
  return messages;
}
