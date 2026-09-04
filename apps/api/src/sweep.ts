import { claimUnprocessedRawEvents } from "./ingest/claim.js";
import { resolveClaimedEvent } from "./resolve/resolve-claimed-event.js";

/**
 * The real-time path is the webhook handlers inserting RawEvent rows; this
 * is the scheduled backstop that actually resolves them (PRD §6: "handler
 * does nothing else, ever" — resolution never happens inline in a webhook
 * request). Hit by an external cron (see AGENTS.md / PRD §3.3), not an
 * in-process timer — Render's free tier can't be trusted to stay resident
 * between requests, so nothing here assumes it is.
 */
export async function runSweep(batchSize = 50): Promise<{ claimed: number }> {
  const events = await claimUnprocessedRawEvents(batchSize);
  for (const event of events) {
    await resolveClaimedEvent(event);
  }
  return { claimed: events.length };
}
