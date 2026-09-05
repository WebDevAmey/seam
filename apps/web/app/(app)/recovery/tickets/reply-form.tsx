"use client";

import { useState, useTransition } from "react";
import { submitReplyAction } from "./reply-action";

const REPLY_CLASS_LABEL: Record<string, string> = {
  PROMISE: "Promise to pay",
  DONE: "Already paid",
  REFUSE: "Refused",
  OPTOUT: "Opted out",
  UNCLEAR: "Unclear",
};

export function ReplyForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ replyClass: string; ticketId: string | null } | null>(null);
  const [recoveryActionId, setRecoveryActionId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+919876543210");
  const [text, setText] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const outcome = await submitReplyAction({ recoveryActionId, customerPhone, text });
          if ("error" in outcome) return;
          setResult(outcome);
          setText("");
        });
      }}
      className="rounded-xl border border-rule bg-surface p-5"
    >
      <p className="text-[13px] text-muted">
        There's no live SMS/WhatsApp inbound webhook yet, so this form stands in for a customer's
        reply arriving. Everything past this point (classification, ticket creation, opt-out) is real.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={recoveryActionId}
          onChange={(e) => setRecoveryActionId(e.target.value)}
          placeholder="recovery action id"
          required
          className="min-w-[220px] flex-1 rounded-lg border border-rule bg-bg px-3 py-2 font-mono-figures text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-primary-tint"
        />
        <input
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="customer phone"
          required
          className="w-[180px] rounded-lg border border-rule bg-bg px-3 py-2 font-mono-figures text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-primary-tint"
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="reply text, e.g. 'STOP' or 'will pay in a bit'"
        required
        rows={2}
        className="mt-3 w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-primary-tint"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Classifying…" : "Simulate inbound reply"}
      </button>
      {result && (
        <p className="mt-3 text-[13px] text-muted">
          Classified as <span className="font-medium text-ink">{REPLY_CLASS_LABEL[result.replyClass] ?? result.replyClass}</span>
          {result.ticketId ? `. Ticket opened (${result.ticketId}).` : ". No ticket needed."}
        </p>
      )}
    </form>
  );
}
