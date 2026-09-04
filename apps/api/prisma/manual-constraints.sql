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
