-- Constraints Prisma can't express in schema.prisma (no native CHECK
-- support as of Prisma 7) but that are real invariants, not optional
-- polish. Run this once against any fresh database, after `db:push` —
-- local dev, a teammate's machine, or the Neon/Render deploy target.
--
--   psql "$DATABASE_URL" -f prisma/manual-constraints.sql
--
-- Safe to re-run: each statement only adds a constraint if it's missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leak_has_evidence'
  ) THEN
    ALTER TABLE "Leak"
      ADD CONSTRAINT leak_has_evidence CHECK (cardinality("evidenceEventIds") > 0);
  END IF;
END $$;

-- The actual idempotency lock (PRD §9, §13 invariant 1): at most one
-- RESERVED-or-DISPATCHED RecoveryAction per (merchant, checkout, class) at
-- a time. A FAILED row doesn't count against this — it must not block a
-- legitimate retry, which is exactly why this can't be a flat @@unique.
CREATE UNIQUE INDEX IF NOT EXISTS recovery_action_active_reservation
  ON "RecoveryAction" ("merchantId", "checkoutId", "actionClass")
  WHERE state IN ('RESERVED', 'DISPATCHED');
