/**
 * Razorpay has no self-serve OAuth for merchants — "Razorpay Connect" OAuth
 * needs partner approval a hackathon build won't have. The realistic pattern
 * or every real test-mode integration: the merchant pastes their Key ID +
 * Key Secret, and we prove they're real by making one authenticated call.
 */
export async function verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<boolean> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.ok;
}
