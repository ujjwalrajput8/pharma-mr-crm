-- MSL No is now assigned by the database: JL-001, JL-002, … in the order
-- doctors are added, never reused, so no two doctors can share one. (The MSL
-- sheet's own numbers repeated — each MR numbers their own list.)
-- Production migrates at boot, so every step tolerates already having run.

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "doctor_msl_seq";

-- Next MSL No. lpad alone would cut "1000" to "100", hence the greatest().
CREATE OR REPLACE FUNCTION next_doctor_msl_no() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  n bigint := nextval('doctor_msl_seq');
BEGIN
  RETURN 'JL-' || lpad(n::text, greatest(3, length(n::text)), '0');
END $$;

-- Doctors already on file are renumbered in the order they were added, and
-- the sequence continues after the last one.
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS n FROM "doctors"
)
UPDATE "doctors" d
   SET "mslNo" = 'JL-' || lpad(numbered.n::text, greatest(3, length(numbered.n::text)), '0')
  FROM numbered
 WHERE d.id = numbered.id;

SELECT setval(
  'doctor_msl_seq',
  greatest((SELECT count(*) FROM "doctors"), 1),
  (SELECT count(*) FROM "doctors") > 0
);

-- AlterTable
ALTER TABLE "doctors" ALTER COLUMN "mslNo" SET DEFAULT next_doctor_msl_no();
ALTER TABLE "doctors" ALTER COLUMN "mslNo" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "doctors_mslNo_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "doctors_mslNo_key" ON "doctors"("mslNo");
