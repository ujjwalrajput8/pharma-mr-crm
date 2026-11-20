-- M2.2: chemist / stockist calls in the DCR. Additive only; safe to run twice.
-- Existing visits become partyType DOCTOR (the default) and keep every value they had.
DO $$ BEGIN
  CREATE TYPE "VisitParty" AS ENUM ('DOCTOR', 'CHEMIST', 'STOCKIST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "orderValue" DECIMAL(12,2);
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "partyType" "VisitParty" NOT NULL DEFAULT 'DOCTOR';

CREATE INDEX IF NOT EXISTS "visits_mrId_chemistId_visitDate_idx" ON "visits"("mrId", "chemistId", "visitDate");

-- "chemistId" existed (unused) since the first migration. NOT VALID: new rows are
-- checked, old rows are left exactly as they are — the constraint can never fail here.
DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_chemistId_fkey" FOREIGN KEY ("chemistId") REFERENCES "medical_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New permissions for logging chemist / stockist calls: customized users (Managers) get
-- them too, like every other role's defaults. Re-running inserts nothing new.
INSERT INTO "user_permissions" ("userId", "permission", "allowed", "createdAt", "updatedAt")
SELECT u."id", p."permission", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN (VALUES ('chemist-visits:own'), ('stockist-visits:own')) AS p("permission")
WHERE u."permissionsCustomized" = true
ON CONFLICT ("userId", "permission") DO NOTHING;
