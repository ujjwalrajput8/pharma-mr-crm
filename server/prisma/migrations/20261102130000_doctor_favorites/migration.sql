-- Per-user starred doctors: each user's favourites list first for them.
-- Production migrates at boot, so every step tolerates already having run.

-- CreateTable
CREATE TABLE IF NOT EXISTS "doctor_favorites" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "doctor_favorites_doctorId_idx" ON "doctor_favorites"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_favorites_userId_doctorId_key" ON "doctor_favorites"("userId", "doctorId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "doctor_favorites" ADD CONSTRAINT "doctor_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "doctor_favorites" ADD CONSTRAINT "doctor_favorites_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
