import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInstallUrl,
  createState,
  decodeState,
  exchangeCodeForAccessToken,
  normaliseShopDomain,
  verifyShopifyCallbackHmac,
} from "./shopify-oauth.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normaliseShopDomain", () => {
  it("appends .myshopify.com to a bare shop name", () => {
    expect(normaliseShopDomain("my-store")).toBe("my-store.myshopify.com");
  });

  it("leaves an already-qualified domain alone", () => {
    expect(normaliseShopDomain("my-store.myshopify.com")).toBe("my-store.myshopify.com");
  });

  it("strips a protocol and trailing slash", () => {
    expect(normaliseShopDomain("https://my-store.myshopify.com/")).toBe("my-store.myshopify.com");
  });
});

describe("createState / decodeState", () => {
  it("round-trips the merchant id and includes a random nonce", () => {
    const state = createState("merchant_123");
    const decoded = decodeState(state);
    expect(decoded.merchantId).toBe("merchant_123");
    expect(decoded.nonce).toHaveLength(32); // 16 random bytes, hex-encoded
  });

  it("produces a different nonce every time, so state can't be replayed", () => {
    expect(createState("merchant_123")).not.toBe(createState("merchant_123"));
  });
});

describe("buildInstallUrl", () => {
  it("points at the shop's own OAuth authorize endpoint with the right params", () => {
    const url = new URL(
      buildInstallUrl({
        shop: "my-store",
        state: "abc",
        clientId: "client_123",
        redirectUri: "https://seam.example.com/shopify/callback",
        scope: "read_orders,read_checkouts",
      }),
    );
    expect(url.hostname).toBe("my-store.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client_123");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("scope")).toBe("read_orders,read_checkouts");
  });
});

describe("verifyShopifyCallbackHmac", () => {
  const CLIENT_SECRET = "shpss_test_secret";

  function signedQuery(params: Record<string, string>): Record<string, string> {
    const message = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    const hmac = createHmac("sha256", CLIENT_SECRET).update(message).digest("hex");
    return { ...params, hmac };
  }

  it("accepts a correctly signed callback query", () => {
    const query = signedQuery({ code: "abc123", shop: "my-store.myshopify.com", state: "xyz" });
    expect(verifyShopifyCallbackHmac(query, CLIENT_SECRET)).toBe(true);
  });

  it("rejects a query with a tampered param", () => {
    const query = signedQuery({ code: "abc123", shop: "my-store.myshopify.com", state: "xyz" });
    query.shop = "attacker-store.myshopify.com";
    expect(verifyShopifyCallbackHmac(query, CLIENT_SECRET)).toBe(false);
  });

  it("rejects a query with no hmac param", () => {
    expect(verifyShopifyCallbackHmac({ code: "abc123" }, CLIENT_SECRET)).toBe(false);
  });
});

describe("exchangeCodeForAccessToken", () => {
  it("posts client_id/client_secret/code and returns the token + scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "shpat_abc", scope: "read_orders" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeCodeForAccessToken(
      "my-store.myshopify.com",
      "code123",
      "client_id",
      "client_secret",
    );

    expect(result).toEqual({ accessToken: "shpat_abc", scope: "read_orders" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://my-store.myshopify.com/admin/oauth/access_token");
    expect(JSON.parse(init.body)).toEqual({
      client_id: "client_id",
      client_secret: "client_secret",
      code: "code123",
    });
  });

  it("throws when Shopify rejects the exchange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(
      exchangeCodeForAccessToken("my-store.myshopify.com", "bad-code", "id", "secret"),
    ).rejects.toThrow();
  });
});
