import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhookSignature } from "./hmac.js";

const SECRET = "whsec_test_12345";
const BODY = JSON.stringify({ event: "payment.failed", payload: {} });

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyRazorpayWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyRazorpayWebhookSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a body that doesn't match the signature", () => {
    const tamperedBody = JSON.stringify({ event: "payment.captured", payload: {} });
    expect(verifyRazorpayWebhookSignature(tamperedBody, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyRazorpayWebhookSignature(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects a missing signature header instead of throwing", () => {
    expect(verifyRazorpayWebhookSignature(BODY, undefined, SECRET)).toBe(false);
  });
});
