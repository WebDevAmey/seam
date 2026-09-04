import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentLink } from "./razorpay-payment-link.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPaymentLink", () => {
  it("posts amount/currency/notes with Basic auth, and returns the link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "plink_abc", short_url: "https://rzp.io/l/abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentLink({
      keyId: "rzp_test_id",
      keySecret: "rzp_test_secret",
      amountPaise: 129900n,
      checkoutId: "checkout_1",
      customerPhone: "+919876543210",
      description: "Complete your order",
    });

    expect(result).toEqual({ id: "plink_abc", shortUrl: "https://rzp.io/l/abc" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/payment_links");
    const expectedAuth = `Basic ${Buffer.from("rzp_test_id:rzp_test_secret").toString("base64")}`;
    expect(init.headers.Authorization).toBe(expectedAuth);
    const body = JSON.parse(init.body);
    expect(body.amount).toBe(129900);
    expect(body.currency).toBe("INR");
    expect(body.notes.checkout_id).toBe("checkout_1");
  });

  it("throws when Razorpay rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(
      createPaymentLink({
        keyId: "id",
        keySecret: "secret",
        amountPaise: 100n,
        checkoutId: "checkout_1",
        description: "test",
      }),
    ).rejects.toThrow();
  });
});
