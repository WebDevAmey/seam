import { describe, expect, it } from "vitest";
import { evaluateShield, type ShieldInput } from "./evaluate.js";

function baseInput(overrides: Partial<ShieldInput> = {}): ShieldInput {
  return {
    optedOut: false,
    now: new Date("2026-09-04T12:00:00Z"), // 17:30 IST — well inside allowed hours
    contactsInLast7Days: 0,
    amountPaise: 100_000n, // ₹1000, well above the floor
    merchantContactsToday: 0,
    merchantDailyOutreachCap: 100,
    messageText: "Hi! Your payment didn't go through — want to try again?",
    evPaise: 5000n,
    autoApproveThresholdPaise: 20_000n,
    ...overrides,
  };
}

describe("evaluateShield — ordered checks, PRD §9", () => {
  it("PASSes a clean, unremarkable case", () => {
    expect(evaluateShield(baseInput())).toEqual({ verdict: "PASS" });
  });

  it("1. opt-out is absolute — no override, checked first", () => {
    const result = evaluateShield(baseInput({ optedOut: true }));
    expect(result.verdict).toBe("BLOCK");
  });

  it("2. blocks at 21:00:00 IST and the second after", () => {
    // 21:00:00 IST == 15:30:00 UTC
    const atBoundary = evaluateShield(baseInput({ now: new Date("2026-09-04T15:30:00Z") }));
    const justAfter = evaluateShield(baseInput({ now: new Date("2026-09-04T15:30:01Z") }));
    expect(atBoundary.verdict).toBe("BLOCK");
    expect(justAfter.verdict).toBe("BLOCK");
  });

  it("2. passes right up to 20:59:59 IST, the second before quiet hours start", () => {
    // 20:59:59 IST == 15:29:59 UTC
    const result = evaluateShield(baseInput({ now: new Date("2026-09-04T15:29:59Z") }));
    expect(result.verdict).not.toBe("BLOCK");
  });

  it("2. blocks at 08:59:59 IST, the second before quiet hours end, and passes at 09:00:00", () => {
    // 08:59:59 IST == 03:29:59 UTC ; 09:00:00 IST == 03:30:00 UTC
    const stillQuiet = evaluateShield(baseInput({ now: new Date("2026-09-04T03:29:59Z") }));
    const nowAllowed = evaluateShield(baseInput({ now: new Date("2026-09-04T03:30:00Z") }));
    expect(stillQuiet.verdict).toBe("BLOCK");
    expect(nowAllowed.verdict).not.toBe("BLOCK");
  });

  it("3. blocks past the max-2-contacts-per-7-days cap", () => {
    expect(evaluateShield(baseInput({ contactsInLast7Days: 2 })).verdict).toBe("BLOCK");
    expect(evaluateShield(baseInput({ contactsInLast7Days: 1 })).verdict).not.toBe("BLOCK");
  });

  it("4. blocks below the ₹200 amount floor", () => {
    expect(evaluateShield(baseInput({ amountPaise: 199_00n })).verdict).toBe("BLOCK");
    expect(evaluateShield(baseInput({ amountPaise: 200_00n })).verdict).not.toBe("BLOCK");
  });

  it("5. blocks once the merchant's daily outreach cap is hit", () => {
    const result = evaluateShield(baseInput({ merchantContactsToday: 10, merchantDailyOutreachCap: 10 }));
    expect(result.verdict).toBe("BLOCK");
  });

  it("7. rejects model-authored text containing a digit", () => {
    const result = evaluateShield(baseInput({ messageText: "Complete your ₹1000 order now" }));
    expect(result.verdict).toBe("BLOCK");
  });

  it("7. rejects model-authored text containing a URL", () => {
    const result = evaluateShield(baseInput({ messageText: "Finish here: https://pay.example.com/x" }));
    expect(result.verdict).toBe("BLOCK");
  });

  it("needs approval when EV clears the auto-approve threshold", () => {
    const result = evaluateShield(baseInput({ evPaise: 25_000n, autoApproveThresholdPaise: 20_000n }));
    expect(result.verdict).toBe("NEEDS_APPROVAL");
  });

  it("checks run in order — opt-out blocks even if quiet hours would too", () => {
    const result = evaluateShield(
      baseInput({ optedOut: true, now: new Date("2026-09-04T15:30:00Z") }),
    );
    expect(result.verdict).toBe("BLOCK");
    expect((result as { reason: string }).reason.toLowerCase()).toContain("opt");
  });

  it("fails closed: an exception thrown mid-check produces BLOCK, never PASS", () => {
    // messageText is required by the type, but nothing stops a caller from
    // passing something that blows up a check at runtime — this is the P0
    // invariant from PRD §9, so it's asserted directly, not assumed.
    const brokenInput = baseInput({ messageText: null as unknown as string });
    const result = evaluateShield(brokenInput);
    expect(result.verdict).toBe("BLOCK");
  });
});
