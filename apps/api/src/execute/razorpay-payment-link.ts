export type CreatePaymentLinkInput = {
  keyId: string;
  keySecret: string;
  amountPaise: bigint;
  checkoutId: string;
  customerPhone?: string;
  customerEmail?: string;
  description: string;
};

export type PaymentLink = { id: string; shortUrl: string };

/**
 * The one place a real link gets minted (test-mode). `reminder_enable` is
 * off on purpose — Shield's contact-cadence rules are what govern follow-up,
 * not Razorpay's own reminder system running in parallel and uncounted.
 */
export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
  const auth = Buffer.from(`${input.keyId}:${input.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number(input.amountPaise),
      currency: "INR",
      description: input.description,
      customer: { contact: input.customerPhone, email: input.customerEmail },
      notes: { checkout_id: input.checkoutId },
      reminder_enable: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment link creation failed: ${response.status}`);
  }

  const data = (await response.json()) as { id: string; short_url: string };
  return { id: data.id, shortUrl: data.short_url };
}
