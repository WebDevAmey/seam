import { describe, expect, it } from "vitest";
import { classifyReply } from "./classify-reply.js";

describe("classifyReply — PRD §8's reply classes, made real", () => {
  it("classifies a promise to pay", () => {
    expect(classifyReply("ok will pay in a bit")).toBe("PROMISE");
    expect(classifyReply("paying now, one sec")).toBe("PROMISE");
  });

  it("classifies confirmation the payment is already done", () => {
    expect(classifyReply("already paid, check again")).toBe("DONE");
    expect(classifyReply("done!")).toBe("DONE");
  });

  it("classifies a refusal", () => {
    expect(classifyReply("not interested, please cancel this order")).toBe("REFUSE");
    expect(classifyReply("no thanks")).toBe("REFUSE");
  });

  it("classifies an opt-out request", () => {
    expect(classifyReply("STOP")).toBe("OPTOUT");
    expect(classifyReply("please unsubscribe me")).toBe("OPTOUT");
  });

  it("opt-out wins even if the message also sounds like a refusal — it's the more consequential, safety-critical read", () => {
    expect(classifyReply("stop messaging me, not interested")).toBe("OPTOUT");
  });

  it("falls back to UNCLEAR rather than guessing at an unrecognisable reply", () => {
    expect(classifyReply("what is this about")).toBe("UNCLEAR");
    expect(classifyReply("👍")).toBe("UNCLEAR");
  });

  it("is case-insensitive", () => {
    expect(classifyReply("PAID ALREADY")).toBe("DONE");
  });
});
