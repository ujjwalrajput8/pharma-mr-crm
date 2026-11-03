-- Profile photos move from the employee profile to the user, so every account
-- (Admin too, who has no employee profile) has one and it shows wherever the
-- person appears. Existing photos are copied over; mr_profiles."photoUrl" stays
-- in place, unused, until the migration squash.
-- Production migrates at boot, so every step tolerates already having run.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- Carry existing photos over.
UPDATE "users" u
   SET "photoUrl" = p."photoUrl"
  FROM "mr_profiles" p
 WHERE p."userId" = u.id
   AND u."photoUrl" IS NULL
   AND p."photoUrl" IS NOT NULL;
