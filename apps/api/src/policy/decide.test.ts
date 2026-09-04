import { describe, expect, it } from "vitest";
import { decide, type PolicyInput } from "./decide.js";

function baseInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    leakAmountPaise: 100_000n, // ₹1000
    diagnosisClass: "METHOD_DECLINED",
    channel: "sms",
    contactsInLast7Days: 0,
    evFloorPaise: 5000n, // ₹50
    now: new Date("2026-09-04T10:00:00Z"),
    downtimeResolvedAt: null,
    ...overrides,
  };
}

describe("decide — diagnosis to action is a fixed table, never a model decision (PRD §9)", () => {
  it("SUSPECTED_FRAUD always escalates, regardless of amount — never auto-contacts", () => {
    const result = decide(baseInput({ diagnosisClass: "SUSPECTED_FRAUD", leakAmountPaise: 1n }));
    expect(result).toEqual({ kind: "action", action: { actionClass: "HOLD_AND_ESCALATE", evPaise: 0n } });
  });

  it("PROMPT_INJECTION_SUSPECTED gets the identical treatment to SUSPECTED_FRAUD — always escalate, never contact", () => {
    const result = decide(
      baseInput({ diagnosisClass: "PROMPT_INJECTION_SUSPECTED", leakAmountPaise: 1n }),
    );
    expect(result).toEqual({ kind: "action", action: { actionClass: "HOLD_AND_ESCALATE", evPaise: 0n } });
  });

  it("UNKNOWN_TRANSIENT is always NO_ACTION — no table entry, no guessing", () => {
    const result = decide(baseInput({ diagnosisClass: "UNKNOWN_TRANSIENT" }));
    expect(result.kind).toBe("no_action");
  });

  it("METHOD_DECLINED maps to ALTERNATE_METHOD_LINK", () => {
    const result = decide(baseInput({ diagnosisClass: "METHOD_DECLINED" }));
    expect(result.kind).toBe("action");
    expect((result as { action: { actionClass: string } }).action.actionClass).toBe(
      "ALTERNATE_METHOD_LINK",
    );
  });

  it("AUTH_FAILED maps to SAME_METHOD_LINK", () => {
    const result = decide(baseInput({ diagnosisClass: "AUTH_FAILED" }));
    expect((result as { action: { actionClass: string } }).action.actionClass).toBe("SAME_METHOD_LINK");
  });

  it("INSUFFICIENT_FUNDS retries at T+48h when no downtime window applies", () => {
    const now = new Date("2026-09-04T10:00:00Z");
    const result = decide(baseInput({ diagnosisClass: "INSUFFICIENT_FUNDS", now }));
    const action = (result as { action: { scheduledFor?: Date } }).action;
    expect(action.scheduledFor?.toISOString()).toBe(new Date(now.getTime() + 48 * 3_600_000).toISOString());
  });

  it("ISSUER_DOWNTIME retries 15 minutes after the downtime window resolves", () => {
    const resolvedAt = new Date("2026-09-04T16:55:00Z");
    const result = decide(
      baseInput({ diagnosisClass: "ISSUER_DOWNTIME", downtimeResolvedAt: resolvedAt }),
    );
    const action = (result as { action: { scheduledFor?: Date } }).action;
    expect(action.scheduledFor?.toISOString()).toBe(new Date(resolvedAt.getTime() + 15 * 60_000).toISOString());
  });

  it("blocks on EV below the merchant's floor", () => {
    const result = decide(
      baseInput({ leakAmountPaise: 100n, evFloorPaise: 5000n, diagnosisClass: "METHOD_DECLINED" }),
    );
    expect(result.kind).toBe("no_action");
  });

  it("annoyance cost can flip a marginal case from action to no_action", () => {
    // deliberately marginal: expected recovery just clears the floor with
    // zero prior contacts, so a few prior contacts should tip it under.
    const marginal = { leakAmountPaise: 20_400n, diagnosisClass: "METHOD_DECLINED" as const };
    const withoutPriorContact = decide(baseInput({ ...marginal, contactsInLast7Days: 0 }));
    const withPriorContacts = decide(baseInput({ ...marginal, contactsInLast7Days: 3 }));
    expect(withoutPriorContact.kind).toBe("action");
    expect(withPriorContacts.kind).toBe("no_action");
  });

  it("a more expensive channel produces a lower EV than a cheaper one, all else equal", () => {
    const sms = decide(baseInput({ channel: "sms" }));
    const whatsapp = decide(baseInput({ channel: "whatsapp" }));
    const smsEv = (sms as { action: { evPaise: bigint } }).action.evPaise;
    const waEv = (whatsapp as { action: { evPaise: bigint } }).action.evPaise;
    expect(waEv).toBeLessThan(smsEv);
  });
});
