-- M2.3: MSL add / remove requests (MR asks, Manager or Admin decides). Additive only;
-- safe to run twice.
DO $$ BEGIN
  CREATE TYPE "MslRequestAction" AS ENUM ('ADD', 'REMOVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MslRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "msl_requests" (
    "id" SERIAL NOT NULL,
    "action" "MslRequestAction" NOT NULL,
    "party" "VisitParty" NOT NULL,
    "mrId" INTEGER NOT NULL,
    "doctorId" INTEGER,
    "storeId" INTEGER,
    "details" JSONB,
    "reason" TEXT,
    "status" "MslRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "msl_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "msl_requests_mrId_status_idx" ON "msl_requests"("mrId", "status");
CREATE INDEX IF NOT EXISTS "msl_requests_status_idx" ON "msl_requests"("status");

DO $$ BEGIN
  ALTER TABLE "msl_requests" ADD CONSTRAINT "msl_requests_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "msl_requests" ADD CONSTRAINT "msl_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "msl_requests" ADD CONSTRAINT "msl_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "msl_requests" ADD CONSTRAINT "msl_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "medical_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Managers with a customized permission set can approve their team's requests too.
INSERT INTO "user_permissions" ("userId", "permission", "allowed", "createdAt", "updatedAt")
SELECT u."id", 'msl-requests:manage', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."permissionsCustomized" = true
ON CONFLICT ("userId", "permission") DO NOTHING;
