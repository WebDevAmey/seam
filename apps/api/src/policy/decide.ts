import type { DiagnosisClass } from "../diagnosis/classify-diagnosis.js";

export type Channel = "whatsapp" | "sms";
export type ActionClass = "DELAYED_RETRY_LINK" | "ALTERNATE_METHOD_LINK" | "SAME_METHOD_LINK" | "HOLD_AND_ESCALATE";

export type ProposedAction = {
  actionClass: ActionClass;
  evPaise: bigint;
  scheduledFor?: Date;
};

export type PolicyDecision =
  | { kind: "action"; action: ProposedAction }
  | { kind: "no_action"; reason: string };

export type PolicyInput = {
  leakAmountPaise: bigint;
  diagnosisClass: DiagnosisClass;
  channel: Channel;
  /** How many times this customer has already been contacted in the last
   * rolling 7 days — computed by the caller from RecoveryAction history. */
  contactsInLast7Days: number;
  evFloorPaise: bigint;
  now: Date;
  /** When the overlapping downtime window resolves, if diagnosis is
   * ISSUER_DOWNTIME — drives the retry schedule. */
  downtimeResolvedAt?: Date | null;
};

/** Hand-set priors — deliberately not learned yet. PRD §9: show these next
 * to realised recovery rates once the outcome worker exists; the gap is the
 * interesting number, not the number itself. */
const P_RECOVER: Record<DiagnosisClass, number> = {
  ISSUER_DOWNTIME: 0.35,
  METHOD_DECLINED: 0.25,
  INSUFFICIENT_FUNDS: 0.15,
  AUTH_FAILED: 0.2,
  SUSPECTED_FRAUD: 0,
  UNKNOWN_TRANSIENT: 0,
  PROMPT_INJECTION_SUSPECTED: 0,
};

/** Diagnosis → action. A fixed table, never a model decision (PRD §9). */
const ACTION_TABLE: Record<DiagnosisClass, ActionClass | null> = {
  ISSUER_DOWNTIME: "DELAYED_RETRY_LINK",
  METHOD_DECLINED: "ALTERNATE_METHOD_LINK",
  INSUFFICIENT_FUNDS: "DELAYED_RETRY_LINK",
  AUTH_FAILED: "SAME_METHOD_LINK",
  SUSPECTED_FRAUD: "HOLD_AND_ESCALATE",
  UNKNOWN_TRANSIENT: null,
  PROMPT_INJECTION_SUSPECTED: "HOLD_AND_ESCALATE",
};

/** Diagnoses that are escalations, not recovery spends — EV math doesn't
 * apply, and neither ever auto-contacts a customer. Suspected fraud and a
 * suspected prompt injection get the identical, maximally-cautious
 * response: a human looks at it, nothing is sent automatically. */
const ESCALATE_NEVER_CONTACT: ReadonlySet<DiagnosisClass> = new Set([
  "SUSPECTED_FRAUD",
  "PROMPT_INJECTION_SUSPECTED",
]);

const CHANNEL_COST_PAISE: Record<Channel, bigint> = {
  whatsapp: 50n,
  sms: 20n,
};

/** A soft brake, not a hard cap (Shield's contact-count check is the hard
 * cap) — every prior contact this week makes the next one look less worth
 * it in EV terms too. */
function annoyanceCostPaise(contactsInLast7Days: number): bigint {
  return contactsInLast7Days > 0 ? BigInt(contactsInLast7Days) * 100n : 0n;
}

function scheduleFor(diagnosisClass: DiagnosisClass, input: PolicyInput): Date | undefined {
  if (diagnosisClass === "ISSUER_DOWNTIME" && input.downtimeResolvedAt) {
    return new Date(input.downtimeResolvedAt.getTime() + 15 * 60_000);
  }
  if (diagnosisClass === "INSUFFICIENT_FUNDS") {
    return new Date(input.now.getTime() + 48 * 3_600_000);
  }
  return undefined;
}

export function decide(input: PolicyInput): PolicyDecision {
  if (ESCALATE_NEVER_CONTACT.has(input.diagnosisClass)) {
    return { kind: "action", action: { actionClass: "HOLD_AND_ESCALATE", evPaise: 0n } };
  }

  const actionClass = ACTION_TABLE[input.diagnosisClass];
  if (!actionClass) {
    return { kind: "no_action", reason: `no action defined for diagnosis ${input.diagnosisClass}` };
  }

  const pRecover = P_RECOVER[input.diagnosisClass];
  const expectedRecoveryPaise = BigInt(Math.round(pRecover * Number(input.leakAmountPaise)));
  const evPaise =
    expectedRecoveryPaise - CHANNEL_COST_PAISE[input.channel] - annoyanceCostPaise(input.contactsInLast7Days);

  if (evPaise < input.evFloorPaise) {
    return { kind: "no_action", reason: `EV ${evPaise} paise below floor ${input.evFloorPaise} paise` };
  }

  return { kind: "action", action: { actionClass, evPaise, scheduledFor: scheduleFor(input.diagnosisClass, input) } };
}
