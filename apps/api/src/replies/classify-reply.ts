export type ReplyClass = "PROMISE" | "DONE" | "REFUSE" | "OPTOUT" | "UNCLEAR";

/**
 * PRD §8's reply classification, made real: a customer's reply to a
 * recovery message gets sorted so the executor knows what to do with it —
 * OPTOUT feeds Shield's absolute opt-out check, REFUSE/UNCLEAR become
 * tickets for a human, PROMISE/DONE are positive signals that don't.
 *
 * OPTOUT is checked first and wins over every other pattern, even one that
 * also matches REFUSE ("stop messaging me, not interested") — it's the
 * more consequential, safety-critical read, same reasoning Shield's own
 * check ordering already uses (opt-out is absolute, checked before
 * anything else).
 */
const PATTERNS: { pattern: RegExp; replyClass: ReplyClass }[] = [
  { pattern: /\bstop\b|unsubscribe|remove me|opt.?out/i, replyClass: "OPTOUT" },
  { pattern: /\bpaid\b|\bdone\b|already (paid|completed)|complete(d)?/i, replyClass: "DONE" },
  { pattern: /will pay|paying now|\bon it\b|going to pay|will complete|will do (it|this)/i, replyClass: "PROMISE" },
  { pattern: /not interested|no thanks|don'?t want|\bcancel\b|leave me alone/i, replyClass: "REFUSE" },
];

export function classifyReply(text: string): ReplyClass {
  for (const { pattern, replyClass } of PATTERNS) {
    if (pattern.test(text)) return replyClass;
  }
  return "UNCLEAR";
}
