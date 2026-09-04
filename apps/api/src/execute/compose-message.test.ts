import { describe, expect, it } from "vitest";
import { composeMessage, phrasingFor } from "./compose-message.js";

describe("phrasingFor — the draft text Shield validates, before any link is injected", () => {
  it("never contains a digit or a URL in any template — Shield's content check depends on this staying true", () => {
    for (const actionClass of ["DELAYED_RETRY_LINK", "ALTERNATE_METHOD_LINK", "SAME_METHOD_LINK"] as const) {
      const text = phrasingFor(actionClass);
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/https?:\/\/|www\./i);
    }
  });
});

describe("composeMessage — injects the real link after Shield has already validated the phrasing", () => {
  it("appends the real payment link to the fixed phrasing", () => {
    const message = composeMessage("ALTERNATE_METHOD_LINK", "https://rzp.io/l/abc123");
    expect(message).toContain("https://rzp.io/l/abc123");
    expect(message.startsWith(phrasingFor("ALTERNATE_METHOD_LINK"))).toBe(true);
  });
});
