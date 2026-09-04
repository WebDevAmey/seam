import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyRazorpayCredentials } from "./razorpay-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyRazorpayCredentials", () => {
  it("sends Basic auth built from keyId:keySecret", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await verifyRazorpayCredentials("rzp_test_abc", "secret123");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/payments?count=1");
    const expectedAuth = `Basic ${Buffer.from("rzp_test_abc:secret123").toString("base64")}`;
    expect(init.headers.Authorization).toBe(expectedAuth);
  });

  it("returns true when Razorpay accepts the credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await verifyRazorpayCredentials("id", "secret")).toBe(true);
  });

  it("returns false when Razorpay rejects the credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await verifyRazorpayCredentials("id", "wrong")).toBe(false);
  });
});
