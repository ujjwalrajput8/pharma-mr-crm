-- P3 — Visits + Today. Additive only: one enum, new nullable / defaulted columns,
-- two indexes and one foreign key. No existing row is rewritten: every visit so far
-- came from an appointment (source = APPOINTMENT) and is not unlisted (offList = false).
-- Safe to run twice.

-- Bulk logging is a UI action only: each doctor gets its own DIRECT visit.
DO $$ BEGIN
  CREATE TYPE "VisitSource" AS ENUM ('APPOINTMENT', 'DIRECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "lastCorrectedAt" TIMESTAMP(3);
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "offList" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "offListReviewAction" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "offListReviewNote" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "offListReviewedAt" TIMESTAMP(3);
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "offListReviewedById" INTEGER;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "source" "VisitSource" NOT NULL DEFAULT 'APPOINTMENT';

CREATE INDEX IF NOT EXISTS "visits_mrId_visitDate_idx" ON "visits"("mrId", "visitDate");
CREATE INDEX IF NOT EXISTS "visits_offList_offListReviewedAt_idx" ON "visits"("offList", "offListReviewedAt");

DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_offListReviewedById_fkey"
    FOREIGN KEY ("offListReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
