-- Leave management, holiday calendar and HR employee-profile fields.

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveDayPart" AS ENUM ('FULL', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL', 'FESTIVAL', 'REGIONAL', 'COMPANY', 'WEEKLY_OFF');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable: stock_counts.status moves off TourPlanStatus onto its own lifecycle enum
ALTER TABLE "stock_counts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "stock_counts"
    ALTER COLUMN "status" TYPE "StockCountStatus" USING ("status"::text::"StockCountStatus");
ALTER TABLE "stock_counts" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable: HR fields on the employee profile
ALTER TABLE "mr_profiles"
    ADD COLUMN "designation" TEXT,
    ADD COLUMN "dob" DATE,
    ADD COLUMN "gender" "Gender",
    ADD COLUMN "bloodGroup" TEXT,
    ADD COLUMN "maritalStatus" TEXT,
    ADD COLUMN "qualification" TEXT,
    ADD COLUMN "emergencyName" TEXT,
    ADD COLUMN "emergencyPhone" TEXT,
    ADD COLUMN "photoUrl" TEXT,
    ADD COLUMN "panNumber" TEXT,
    ADD COLUMN "aadhaarNumber" TEXT,
    ADD COLUMN "bankName" TEXT,
    ADD COLUMN "bankAccountNo" TEXT,
    ADD COLUMN "bankIfsc" TEXT,
    ADD COLUMN "exitDate" DATE,
    ADD COLUMN "exitReason" TEXT;

-- AlterTable: attendance keeps work-type separate from status
ALTER TABLE "attendances"
    ADD COLUMN "workType" "WorkType",
    ADD COLUMN "leaveRequestId" INTEGER;

-- CreateIndex
CREATE INDEX "attendances_workType_idx" ON "attendances"("workType");

-- CreateIndex
CREATE INDEX "attendances_leaveRequestId_idx" ON "attendances"("leaveRequestId");

-- CreateTable
CREATE TABLE "leave_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualQuota" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForward" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
    "requiresProof" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT NOT NULL DEFAULT '#0f766e',
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "dayPart" "LeaveDayPart" NOT NULL DEFAULT 'FULL',
    "days" DECIMAL(5,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "contactPhone" TEXT,
    "attachmentUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" INTEGER,
    "actedAt" TIMESTAMP(3),
    "decisionRemark" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "opening" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "used" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "encashed" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL DEFAULT 'NATIONAL',
    "territoryId" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");
CREATE INDEX "leave_types_status_idx" ON "leave_types"("status");
CREATE INDEX "leave_types_deletedAt_idx" ON "leave_types"("deletedAt");

-- CreateIndex
CREATE INDEX "leave_requests_userId_idx" ON "leave_requests"("userId");
CREATE INDEX "leave_requests_leaveTypeId_idx" ON "leave_requests"("leaveTypeId");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX "leave_requests_fromDate_idx" ON "leave_requests"("fromDate");
CREATE INDEX "leave_requests_toDate_idx" ON "leave_requests"("toDate");
CREATE INDEX "leave_requests_deletedAt_idx" ON "leave_requests"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_userId_leaveTypeId_year_key" ON "leave_balances"("userId", "leaveTypeId", "year");
CREATE INDEX "leave_balances_userId_idx" ON "leave_balances"("userId");
CREATE INDEX "leave_balances_year_idx" ON "leave_balances"("year");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_holidayDate_name_key" ON "holidays"("holidayDate", "name");
CREATE INDEX "holidays_holidayDate_idx" ON "holidays"("holidayDate");
CREATE INDEX "holidays_territoryId_idx" ON "holidays"("territoryId");
CREATE INDEX "holidays_status_idx" ON "holidays"("status");
CREATE INDEX "holidays_deletedAt_idx" ON "holidays"("deletedAt");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
