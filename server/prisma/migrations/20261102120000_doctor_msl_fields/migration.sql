-- Doctor master now follows the company MSL sheet:
-- MSL No · Area (HQ/EX) · Doctor's Name · Mobile No · MSL Class · Speciality ·
-- Address · Email ID · Birthday · Anniversary.
-- The old form's columns (hospital, clinic, city, …) stay in place, unused, so
-- nothing is lost.
--
-- Written to be safe on the production database, which was first created with
-- `prisma db push` (index names are not guaranteed) and migrates at boot:
-- every step tolerates already having run.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DoctorAreaType" AS ENUM ('HQ', 'EX', 'OS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "doctors"
  ADD COLUMN IF NOT EXISTS "mslNo" TEXT,
  ADD COLUMN IF NOT EXISTS "area" TEXT,
  ADD COLUMN IF NOT EXISTS "areaType" "DoctorAreaType",
  ADD COLUMN IF NOT EXISTS "address" TEXT;

-- MSL class becomes free text. The old A/B/C column was never editable, so
-- every row holds the database default 'B' — clear it rather than show a class
-- nobody chose.
DROP INDEX IF EXISTS "doctors_category_idx";
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'doctors' AND column_name = 'category'
  ) THEN
    ALTER TABLE "doctors" ALTER COLUMN "category" DROP DEFAULT;
    ALTER TABLE "doctors" ALTER COLUMN "category" DROP NOT NULL;
    ALTER TABLE "doctors" ALTER COLUMN "category" TYPE TEXT USING NULL;
    ALTER TABLE "doctors" RENAME COLUMN "category" TO "mslClass";
  ELSE
    ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "mslClass" TEXT;
  END IF;
END $$;
DROP TYPE IF EXISTS "DoctorCategory";

-- Carry existing values into the new single-line fields.
UPDATE "doctors" SET "area" = NULLIF(BTRIM("city"), '') WHERE "area" IS NULL;
UPDATE "doctors" SET "address" = NULLIF(
  CONCAT_WS(', ',
    NULLIF(BTRIM("addressLine1"), ''),
    NULLIF(BTRIM("addressLine2"), ''),
    NULLIF(BTRIM("city"), ''),
    NULLIF(BTRIM("state"), ''),
    NULLIF(BTRIM("pincode"), '')),
  '')
WHERE "address" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "doctors_city_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "doctors_mslNo_idx" ON "doctors"("mslNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "doctors_area_idx" ON "doctors"("area");
