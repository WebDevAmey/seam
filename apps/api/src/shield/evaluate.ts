export type ShieldVerdict =
  | { verdict: "PASS" }
  | { verdict: "BLOCK"; reason: string }
  | { verdict: "NEEDS_APPROVAL"; reason: string };

export type ShieldInput = {
  optedOut: boolean;
  now: Date;
  contactsInLast7Days: number;
  amountPaise: bigint;
  merchantContactsToday: number;
  merchantDailyOutreachCap: number;
  messageText: string;
  evPaise: bigint;
  autoApproveThresholdPaise: bigint;
};

const MAX_CONTACTS_PER_7_DAYS = 2;
const AMOUNT_FLOOR_PAISE = 200_00n;
const IST_OFFSET_MINUTES = 5.5 * 60;

function istHour(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000).getUTCHours();
}

function isQuietHoursIST(date: Date): boolean {
  const hour = istHour(date);
  return hour >= 21 || hour < 9;
}

/** `.match()`, not `.test()` — a null/undefined text should throw here and
 * fall to the fail-closed wrapper below, not silently coerce to "null" and
 * pass every check. */
function contentViolation(text: string): string | null {
  if (text.match(/\d/)) return "message contains a digit";
  if (text.match(/https?:\/\/|www\./i)) return "message contains a URL";
  return null;
}

function runChecks(input: ShieldInput): ShieldVerdict {
  if (input.optedOut) {
    return { verdict: "BLOCK", reason: "customer has opted out / is on the DND list" };
  }
  if (isQuietHoursIST(input.now)) {
    return { verdict: "BLOCK", reason: "quiet hours (21:00-09:00 IST), deferred, never sent" };
  }
  if (input.contactsInLast7Days >= MAX_CONTACTS_PER_7_DAYS) {
    return {
      verdict: "BLOCK",
      reason: `already contacted ${input.contactsInLast7Days} times in the last 7 days`,
    };
  }
  if (input.amountPaise < AMOUNT_FLOOR_PAISE) {
    return { verdict: "BLOCK", reason: "amount below the ₹200 recovery floor" };
  }
  if (input.merchantContactsToday >= input.merchantDailyOutreachCap) {
    return { verdict: "BLOCK", reason: "merchant's daily outreach cap reached" };
  }

  const violation = contentViolation(input.messageText);
  if (violation) {
    return { verdict: "BLOCK", reason: violation };
  }

  if (input.evPaise > input.autoApproveThresholdPaise) {
    return { verdict: "NEEDS_APPROVAL", reason: "EV above the auto-approve threshold" };
  }

  return { verdict: "PASS" };
}

/**
 * Ordered checks, PRD §9. Fail-closed: any exception thrown by a check
 * becomes BLOCK, never PASS — this is the actual P0 invariant, asserted
 * directly by a test, not assumed to hold because the code "looks safe."
 */
export function evaluateShield(input: ShieldInput): ShieldVerdict {
  try {
    return runChecks(input);
  } catch {
    return { verdict: "BLOCK", reason: "Shield check threw, failing closed" };
  }
}
