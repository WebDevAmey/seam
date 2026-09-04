import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay signs webhook bodies as HMAC-SHA256(rawBody, webhookSecret), hex
 * digest, in the `X-Razorpay-Signature` header. Verify against the *raw*
 * body — parsing to JSON first and re-serializing would silently break this
 * for any payload whose re-serialization isn't byte-identical.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Shopify signs webhook bodies as HMAC-SHA256(rawBody, appClientSecret),
 * base64 digest (not hex), in `X-Shopify-Hmac-Sha256`. One secret for every
 * shop the app is installed on — this is the app's own client secret, not
 * a per-merchant value like Razorpay's webhook secret.
 */
export function verifyShopifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  clientSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", clientSecret).update(rawBody, "utf8").digest("base64");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
