import { MessagesSquare } from "lucide-react";
import { getTickets } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Message, MessageBubble, MessageBubbleContent } from "@/components/agents/message";
import { ReplyForm } from "./reply-form";

const REPLY_CLASS_LABEL: Record<string, string> = {
  PROMISE: "Promise to pay",
  DONE: "Already paid",
  REFUSE: "Refused",
  OPTOUT: "Opted out",
  UNCLEAR: "Unclear",
};

function classTone(replyClass: string): BadgeTone {
  if (replyClass === "OPTOUT" || replyClass === "REFUSE") return "risk";
  return "neutral";
}

export default async function TicketsPage() {
  const merchantId = await requireCurrentMerchantId();
  const tickets = await getTickets(merchantId);

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="font-heading text-[20px] font-semibold text-ink">Recovery conversations</h1>
      <p className="mt-1 max-w-[64ch] text-[13px] text-muted">
        Replies that need a human: a refusal, an opt-out, or anything the classifier couldn't read
        confidently. Promises and confirmations don't need a human, so they don't show up here.
      </p>

      <div className="mt-6">
        <ReplyForm />
      </div>

      <div className="mt-6">
        {tickets.length === 0 ? (
          <Card>
            <CardBody>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessagesSquare />
                  </EmptyMedia>
                  <EmptyTitle>No open conversations</EmptyTitle>
                  <EmptyDescription>Every reply that needed a human is already handled.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardBody>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone={classTone(ticket.replyClass)}>{REPLY_CLASS_LABEL[ticket.replyClass] ?? ticket.replyClass}</Badge>
                      <Badge tone={ticket.status === "OPEN" ? "pending" : "neutral"}>{ticket.status}</Badge>
                    </div>
                    <span className="font-mono-figures text-[11px] text-muted">{new Date(ticket.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  <Message from="user" animateIn={false}>
                    <MessageBubble>
                      <MessageBubbleContent>{ticket.replyText}</MessageBubbleContent>
                    </MessageBubble>
                  </Message>
                  <p className="mt-2 font-mono-figures text-[11px] text-muted">action: {ticket.recoveryActionId}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
