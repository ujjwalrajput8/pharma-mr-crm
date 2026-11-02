-- Drops the old doctor form's columns, now that the doctor master follows the
-- MSL sheet. Runs after 20261102120000_doctor_msl_fields, which already copied
-- city → area and the address lines → address. Everything else here
-- (hospital, clinic, visiting days, …) is deleted for good.
--
-- Production migrates at boot, so every step tolerates already having run.

-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_territoryId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "doctors_territoryId_idx";
DROP INDEX IF EXISTS "doctors_city_idx";

-- AlterTable
ALTER TABLE "doctors"
  DROP COLUMN IF EXISTS "addressLine1",
  DROP COLUMN IF EXISTS "addressLine2",
  DROP COLUMN IF EXISTS "approvedBy",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "clinic",
  DROP COLUMN IF EXISTS "degree",
  DROP COLUMN IF EXISTS "hospital",
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "notes",
  DROP COLUMN IF EXISTS "pincode",
  DROP COLUMN IF EXISTS "preferredTime",
  DROP COLUMN IF EXISTS "regNo",
  DROP COLUMN IF EXISTS "state",
  DROP COLUMN IF EXISTS "territoryId",
  DROP COLUMN IF EXISTS "visitFreqPm",
  DROP COLUMN IF EXISTS "visitingDays";
