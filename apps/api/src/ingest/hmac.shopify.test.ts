import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyWebhookSignature } from "./hmac.js";

const SECRET = "shpss_test_secret";
const BODY = JSON.stringify({ id: 123456, email: "buyer@example.com" });

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("verifyShopifyWebhookSignature", () => {
  it("accepts a correctly signed body (Shopify signs base64, not hex)", () => {
    expect(verifyShopifyWebhookSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a body that doesn't match the signature", () => {
    const tamperedBody = JSON.stringify({ id: 999999, email: "buyer@example.com" });
    expect(verifyShopifyWebhookSignature(tamperedBody, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong client secret", () => {
    expect(verifyShopifyWebhookSignature(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects a missing signature header instead of throwing", () => {
    expect(verifyShopifyWebhookSignature(BODY, undefined, SECRET)).toBe(false);
  });
});
