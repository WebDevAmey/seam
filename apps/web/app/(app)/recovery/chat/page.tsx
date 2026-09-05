import { getChatThreads } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const merchantId = await requireCurrentMerchantId();
  const threads = await getChatThreads(merchantId);

  return (
    <div className="flex h-screen flex-col px-6 py-8 sm:px-10">
      <div>
        <h1 className="font-heading text-[20px] font-semibold text-ink">Chat with your store</h1>
        <p className="mt-1 max-w-[64ch] text-[13px] text-muted">
          Ask about leaks, recovery opportunities, open conversations, or ledger integrity. Every
          number comes from a real tool call. You can see exactly which one under each reply.
        </p>
      </div>
      <div className="mt-6 min-h-0 flex-1">
        <ChatClient threads={threads} />
      </div>
    </div>
  );
}
