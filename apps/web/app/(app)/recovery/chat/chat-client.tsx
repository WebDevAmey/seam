"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus, Bot, Sparkles } from "lucide-react";
import { Message, MessageBubble, MessageBubbleContent, MessageScroller } from "@/components/agents/message";
import { PromptInput } from "@/components/agents/prompt-input";
import { ThinkingShimmer } from "@/components/agents/loading-states/thinking-shimmer";
import { ToolResult, ToolResultOutput } from "@/components/agents/tool-result";
import type { ChatThread, ChatToolCall } from "@/lib/api";
import { loadThreadAction, sendMessageAction } from "./chat-actions";

type LocalMessage = { role: "user" | "assistant"; content: string; toolCalls: ChatToolCall[] | null };

const SUGGESTIONS = [
  "How much have I leaked this week?",
  "What should I act on right now?",
  "Which payment method is failing the most?",
  "Is my ledger intact?",
];

export function ChatClient({ threads: initialThreads }: { threads: ChatThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startNewChat() {
    setThreadId(null);
    setMessages([]);
    setError(null);
  }

  function openThread(id: string) {
    setThreadId(id);
    setError(null);
    startTransition(async () => {
      const history = await loadThreadAction(id);
      setMessages(
        history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content, toolCalls: m.toolCalls })),
      );
    });
  }

  function handleSubmit(value: string) {
    if (!value.trim()) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: value, toolCalls: null }]);
    startTransition(async () => {
      const result = await sendMessageAction(threadId, value);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (!threadId) {
        setThreadId(result.threadId);
        setThreads((prev) => [{ id: result.threadId, merchantId: "", title: value.slice(0, 60), createdAt: new Date().toISOString() }, ...prev]);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply, toolCalls: result.toolCalls }]);
    });
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-rule pr-4 sm:flex">
        <button
          onClick={startNewChat}
          className="flex items-center gap-2 rounded-lg border border-rule bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:border-primary hover:text-primary"
        >
          <MessageSquarePlus className="size-3.5" strokeWidth={1.8} />
          New chat
        </button>
        <div className="mt-3 flex flex-col gap-0.5">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t.id)}
              className={`truncate rounded-lg px-2.5 py-1.5 text-left text-[12.5px] ${
                t.id === threadId ? "bg-primary-tint text-primary" : "text-muted hover:bg-primary-tint/60 hover:text-ink"
              }`}
            >
              {t.title || "Untitled"}
            </button>
          ))}
        </div>
      </aside>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-tint text-primary">
              <Sparkles className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="font-heading text-[19px] font-semibold text-ink">Ask Seam about your store</h2>
              <p className="mt-1 max-w-[46ch] text-[13px] text-muted">
                Every answer comes from a real tool call against your own data. Nothing is made up.
              </p>
            </div>
          </div>

          <div className="w-full max-w-[560px]">
            <PromptInput placeholder="Ask about your store…" loading={pending} onSubmit={(value) => handleSubmit(value)} />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  disabled={pending}
                  className="rounded-full border border-rule bg-surface px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-center text-[13px] text-at-risk">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageScroller className="min-h-0 flex-1" contentClassName="flex flex-col gap-4 px-1 py-2">
            {messages.map((m, i) => (
              <Message key={i} from={m.role}>
                <MessageBubble>
                  <MessageBubbleContent>{m.content}</MessageBubbleContent>
                </MessageBubble>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 flex w-full max-w-[520px] flex-col gap-1.5">
                    {m.toolCalls.map((tc, j) => (
                      <ToolResult key={j} tool={<Bot className="size-3.5" strokeWidth={1.8} />} title={tc.toolName} status="success">
                        <ToolResultOutput language="json">{JSON.stringify(tc.output, null, 2)}</ToolResultOutput>
                      </ToolResult>
                    ))}
                  </div>
                )}
              </Message>
            ))}
            {pending && messages.at(-1)?.role === "user" && (
              <Message from="assistant">
                <ThinkingShimmer>Thinking</ThinkingShimmer>
              </Message>
            )}
          </MessageScroller>

          {error && <p className="mt-2 text-[13px] text-at-risk">{error}</p>}

          <div className="mt-3">
            <PromptInput placeholder="Ask about your store…" loading={pending} onSubmit={(value) => handleSubmit(value)} />
          </div>
        </div>
      )}
    </div>
  );
}
