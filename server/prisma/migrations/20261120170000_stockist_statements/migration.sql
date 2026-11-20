-- M2.4: stockist statements (monthly, entered by the MR; quarterly / yearly are
-- calculated). Additive only; safe to run twice.
DO $$ BEGIN
  CREATE TYPE "StatementStatus" AS ENUM ('DRAFT', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "stockist_statements" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "mrId" INTEGER NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "stockist_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stockist_statement_lines" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "opening" INTEGER NOT NULL DEFAULT 0,
    "receipt" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "returns" INTEGER NOT NULL DEFAULT 0,
    "closing" INTEGER NOT NULL DEFAULT 0,
    "rate" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stockist_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stockist_statements_mrId_month_idx" ON "stockist_statements"("mrId", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "stockist_statements_storeId_month_key" ON "stockist_statements"("storeId", "month");
CREATE INDEX IF NOT EXISTS "stockist_statement_lines_medicineId_idx" ON "stockist_statement_lines"("medicineId");
CREATE UNIQUE INDEX IF NOT EXISTS "stockist_statement_lines_statementId_medicineId_key" ON "stockist_statement_lines"("statementId", "medicineId");

DO $$ BEGIN
  ALTER TABLE "stockist_statements" ADD CONSTRAINT "stockist_statements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "medical_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stockist_statements" ADD CONSTRAINT "stockist_statements_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stockist_statement_lines" ADD CONSTRAINT "stockist_statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "stockist_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stockist_statement_lines" ADD CONSTRAINT "stockist_statement_lines_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Customized Managers can see / correct their team's statements too.
INSERT INTO "user_permissions" ("userId", "permission", "allowed", "createdAt", "updatedAt")
SELECT u."id", 'stockist-statement:manage', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."permissionsCustomized" = true
ON CONFLICT ("userId", "permission") DO NOTHING;
