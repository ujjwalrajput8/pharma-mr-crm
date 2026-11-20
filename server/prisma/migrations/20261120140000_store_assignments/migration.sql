-- M2.1: chemists / stockists in an MR's MSL list — assignment history like doctors.
-- Additive only (one new table); safe to run twice.
CREATE TABLE IF NOT EXISTS "store_assignments" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "mrId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "store_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "store_assignments_mrId_idx" ON "store_assignments"("mrId");
CREATE INDEX IF NOT EXISTS "store_assignments_storeId_idx" ON "store_assignments"("storeId");
CREATE INDEX IF NOT EXISTS "store_assignments_isActive_idx" ON "store_assignments"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "store_assignments_storeId_mrId_key" ON "store_assignments"("storeId", "mrId");

DO $$ BEGIN
  ALTER TABLE "store_assignments" ADD CONSTRAINT "store_assignments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "medical_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_assignments" ADD CONSTRAINT "store_assignments_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
