import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Unlike Razorpay, Shopify has a real merchant-facing OAuth flow — this
 * module implements that flow's pure/mockable parts. `exchangeCodeForAccessToken`
 * is the one bit that needs a live Shopify app (client id/secret) and a real
 * store to fully exercise end to end.
 */

export function normaliseShopDomain(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return trimmed.endsWith(".myshopify.com") ? trimmed : `${trimmed}.myshopify.com`;
}

/** Carries the merchant id through the OAuth redirect, plus a nonce so a
 * captured callback URL can't be replayed to link a shop to the wrong
 * merchant or twice. */
export function createState(merchantId: string): string {
  const nonce = randomBytes(16).toString("hex");
  return Buffer.from(JSON.stringify({ merchantId, nonce })).toString("base64url");
}

export function decodeState(state: string): { merchantId: string; nonce: string } {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
}

export function buildInstallUrl(options: {
  shop: string;
  state: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}): string {
  const url = new URL(`https://${normaliseShopDomain(options.shop)}/admin/oauth/authorize`);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("scope", options.scope);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  return url.toString();
}

/**
 * Shopify signs the OAuth callback query string itself: drop `hmac` and
 * `signature`, sort the remaining params by key, join as `key=value&...`,
 * HMAC-SHA256 hex digest with the app's client secret.
 */
export function verifyShopifyCallbackHmac(
  query: Record<string, string>,
  clientSecret: string,
): boolean {
  const { hmac } = query;
  if (!hmac) return false;

  const message = Object.keys(query)
    .filter((key) => key !== "hmac" && key !== "signature")
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");

  const expected = createHmac("sha256", clientSecret).update(message).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(hmac, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function exchangeCodeForAccessToken(
  shop: string,
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch(`https://${normaliseShopDomain(shop)}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!response.ok) {
    throw new Error(`Shopify token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; scope: string };
  return { accessToken: data.access_token, scope: data.scope };
}
