-- BRD alignment migration (safe for local/dev with existing seed data)

-- RecordStatus enum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AppointmentStatus: SCHEDULED/MISSED → PENDING/CANCELLED
ALTER TABLE "appointments" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "AppointmentStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "appointments"
  ALTER COLUMN "status" TYPE "AppointmentStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SCHEDULED' THEN 'PENDING'
      WHEN 'MISSED' THEN 'CANCELLED'
      WHEN 'COMPLETED' THEN 'COMPLETED'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      ELSE 'PENDING'
    END::"AppointmentStatus_new"
  );

DROP TYPE "AppointmentStatus";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
ALTER TABLE "appointments" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"AppointmentStatus";

-- Appointment purpose
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "purpose" TEXT;

-- Doctor BRD fields
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT;
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "visitingDays" TEXT;
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';

-- Medical store: rename contactName → ownerName + new fields
ALTER TABLE "medical_stores" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
UPDATE "medical_stores" SET "ownerName" = "contactName" WHERE "ownerName" IS NULL AND "contactName" IS NOT NULL;
ALTER TABLE "medical_stores" DROP COLUMN IF EXISTS "contactName";
ALTER TABLE "medical_stores" ADD COLUMN IF NOT EXISTS "drugLicenseNumber" TEXT;
ALTER TABLE "medical_stores" ADD COLUMN IF NOT EXISTS "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';

-- Medicine BRD fields
ALTER TABLE "medicines" ADD COLUMN IF NOT EXISTS "sampleAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "medicines" ADD COLUMN IF NOT EXISTS "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "medicines" ADD COLUMN IF NOT EXISTS "strength" TEXT;

-- Stock: rename quantity → openingStock
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "openingStock" INTEGER NOT NULL DEFAULT 0;
UPDATE "stocks" SET "openingStock" = "quantity" WHERE "quantity" IS NOT NULL;
ALTER TABLE "stocks" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "minimumStockAlert" INTEGER NOT NULL DEFAULT 10;

-- Clear visit/distribution rows that cannot satisfy new NOT NULL FKs
DELETE FROM "medicine_distributions";
DELETE FROM "visit_products";
DELETE FROM "visits";

-- Visit BRD fields + 1:1 appointment link
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "appointmentId" UUID;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "discussionNotes" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "doctorFeedback" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "meetingDurationMin" INTEGER;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "visitTime" TIME(0);
ALTER TABLE "visits" ALTER COLUMN "visitDate" TYPE DATE USING ("visitDate"::date);
ALTER TABLE "visits" ALTER COLUMN "nextFollowUp" TYPE DATE USING ("nextFollowUp"::date);

-- Medicine distributions must belong to a visit
ALTER TABLE "medicine_distributions" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "medicine_distributions" ADD COLUMN IF NOT EXISTS "visitId" UUID;

-- MR profiles
CREATE TABLE IF NOT EXISTS "mr_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "address" TEXT,
    "joiningDate" DATE,
    "assignedArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "mr_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mr_profiles_userId_key" ON "mr_profiles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "mr_profiles_employeeCode_key" ON "mr_profiles"("employeeCode");
CREATE INDEX IF NOT EXISTS "mr_profiles_employeeCode_idx" ON "mr_profiles"("employeeCode");
CREATE INDEX IF NOT EXISTS "mr_profiles_assignedArea_idx" ON "mr_profiles"("assignedArea");
CREATE INDEX IF NOT EXISTS "mr_profiles_deletedAt_idx" ON "mr_profiles"("deletedAt");
CREATE INDEX IF NOT EXISTS "doctors_status_idx" ON "doctors"("status");
CREATE INDEX IF NOT EXISTS "medical_stores_status_idx" ON "medical_stores"("status");
CREATE INDEX IF NOT EXISTS "medicines_status_idx" ON "medicines"("status");
CREATE INDEX IF NOT EXISTS "stocks_available_idx" ON "stocks"("available");
CREATE INDEX IF NOT EXISTS "medicine_distributions_visitId_idx" ON "medicine_distributions"("visitId");

DO $$ BEGIN
  ALTER TABLE "mr_profiles" ADD CONSTRAINT "mr_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "medicine_distributions" ADD CONSTRAINT "medicine_distributions_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "visits_appointmentId_key" ON "visits"("appointmentId");
