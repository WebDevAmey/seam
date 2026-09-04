import { prisma } from "../prisma.js";

export type ReserveInput = {
  merchantId: string;
  checkoutId: string;
  leakId: string;
  actionClass: string;
  evPaise: bigint;
  shieldVerdict: string;
  shieldReason?: string | null;
};

export type ReserveResult = { reserved: true; actionId: string } | { reserved: false };

function isUniqueViolation(error: unknown): boolean {
  // Prisma's own P2002 covers constraints it declared; our real constraint
  // is a partial index in manual-constraints.sql that Prisma doesn't know
  // about, so it surfaces as a raw Postgres unique_violation (23505)
  // instead — check both rather than assume which one shows up.
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return true;
  return error instanceof Error && /duplicate key value violates unique constraint/i.test(error.message);
}

/**
 * The reservation IS the lock (PRD §9, §13 invariant 1) — enforced by the
 * partial unique index on (merchant, checkout, actionClass) WHERE state IN
 * ('RESERVED','DISPATCHED'), not by application-level discipline. Under N
 * concurrent identical requests, exactly one `create` succeeds; the rest
 * hit the constraint and come back `reserved: false` instead of erroring.
 */
export async function reserveAction(input: ReserveInput): Promise<ReserveResult> {
  try {
    const action = await prisma.recoveryAction.create({
      data: {
        merchantId: input.merchantId,
        checkoutId: input.checkoutId,
        leakId: input.leakId,
        actionClass: input.actionClass,
        state: "RESERVED",
        idempotencyKey: `${input.merchantId}:${input.checkoutId}:${input.actionClass}`,
        evPaise: input.evPaise,
        shieldVerdict: input.shieldVerdict,
        shieldReason: input.shieldReason ?? null,
      },
    });
    return { reserved: true, actionId: action.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { reserved: false };
    throw error;
  }
}
