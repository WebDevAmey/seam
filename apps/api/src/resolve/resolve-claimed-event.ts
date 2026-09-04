import type { ClaimedRawEvent } from "../ingest/claim.js";
import { resolvePaymentEvent } from "./resolve-payment-event.js";
import { resolveShopifyEvent } from "./resolve-shopify-event.js";

export async function resolveClaimedEvent(event: ClaimedRawEvent): Promise<void> {
  if (event.source === "shopify") {
    await resolveShopifyEvent(event);
  } else if (event.source === "razorpay") {
    await resolvePaymentEvent(event);
  }
  // unrecognised source: leave it claimed-but-unresolved rather than guess.
}
