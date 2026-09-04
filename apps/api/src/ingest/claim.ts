import { prisma } from "../prisma.js";

export type ClaimedRawEvent = {
  id: string;
  merchantId: string;
  source: string;
  eventType: string;
  payload: unknown;
};

/**
 * Postgres IS the queue (PRD §6): no Redis, no broker. `FOR UPDATE SKIP
 * LOCKED` lets N concurrent workers each grab a disjoint batch of
 * unprocessed rows without blocking on each other or double-claiming —
 * proven in claim.test.ts, not assumed.
 */
export async function claimUnprocessedRawEvents(limit: number): Promise<ClaimedRawEvent[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedRawEvent[]>`
      SELECT id, "merchantId", source, "eventType", payload
      FROM "RawEvent"
      WHERE "processedAt" IS NULL
      ORDER BY "receivedAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) return [];

    await tx.rawEvent.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { processedAt: new Date() },
    });

    return rows;
  });
}
