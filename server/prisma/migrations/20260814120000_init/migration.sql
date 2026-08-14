-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'MR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TerritoryType" AS ENUM ('STATE', 'DISTRICT', 'HQ', 'BEAT');

-- CreateEnum
CREATE TYPE "DoctorCategory" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "ChemistType" AS ENUM ('CHEMIST', 'STOCKIST');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'PENDING', 'COMPLETED', 'VISITED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY', 'OFFICE', 'JOINT_WORK', 'FLAGGED');

-- CreateEnum
CREATE TYPE "TourPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('FIELD', 'OFFICE', 'JOINT_WORK', 'LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('OPENING', 'RECEIPT', 'TRANSFER', 'ISSUE', 'SAMPLE_GIVEN', 'GIFT_GIVEN', 'SALE', 'RETURN', 'EXPIRY_WRITEOFF', 'ADJUSTMENT', 'LOST');

-- CreateEnum
CREATE TYPE "HolderType" AS ENUM ('WAREHOUSE', 'USER', 'DOCTOR', 'CHEMIST');

-- CreateEnum
CREATE TYPE "StockRefType" AS ENUM ('ISSUE', 'VISIT', 'RETURN', 'COUNT', 'SALE', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "managerId" INTEGER,
    "territoryId" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "permissionsCustomized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mr_profiles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "address" TEXT,
    "joiningDate" DATE,
    "assignedArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "mr_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TerritoryType" NOT NULL,
    "parentId" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialization" TEXT,
    "degree" TEXT,
    "regNo" TEXT,
    "category" "DoctorCategory" NOT NULL DEFAULT 'B',
    "hospital" TEXT,
    "clinic" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "territoryId" INTEGER,
    "visitFreqPm" INTEGER,
    "visitingDays" TEXT,
    "preferredTime" TEXT,
    "birthday" DATE,
    "anniversary" DATE,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_assignments" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "mrId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "doctor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_stores" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChemistType" NOT NULL DEFAULT 'CHEMIST',
    "ownerName" TEXT,
    "gstNumber" TEXT,
    "drugLicenseNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "territoryId" INTEGER,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "medical_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "brandName" TEXT,
    "genericName" TEXT,
    "company" TEXT,
    "composition" TEXT,
    "strength" TEXT,
    "category" TEXT,
    "packSize" TEXT,
    "mrp" DECIMAL(12,2) NOT NULL,
    "ptr" DECIMAL(12,2),
    "pts" DECIMAL(12,2),
    "sku" TEXT,
    "description" TEXT,
    "sampleAvailable" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "batchNo" TEXT NOT NULL,
    "mfgDate" DATE,
    "expiryDate" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_txns" (
    "id" SERIAL NOT NULL,
    "txnNo" TEXT NOT NULL,
    "txnType" "StockTxnType" NOT NULL,
    "txnDate" DATE NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "fromHolderType" "HolderType",
    "fromHolderId" INTEGER,
    "toHolderType" "HolderType",
    "toHolderId" INTEGER,
    "refType" "StockRefType",
    "refId" INTEGER,
    "note" TEXT,
    "clientUuid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "stock_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" SERIAL NOT NULL,
    "holderType" "HolderType" NOT NULL,
    "holderId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "countDate" DATE NOT NULL,
    "status" "TourPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" SERIAL NOT NULL,
    "countId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "physicalQty" INTEGER NOT NULL,
    "diff" INTEGER NOT NULL,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "attDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "workingMins" INTEGER,
    "inLat" DOUBLE PRECISION,
    "inLng" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "isMockLocation" BOOLEAN NOT NULL DEFAULT false,
    "deviceAt" TIMESTAMP(3),
    "serverAt" TIMESTAMP(3),
    "photoUrl" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "flagReason" TEXT,
    "approvedById" INTEGER,
    "locationNote" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_plans" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "planMonth" DATE NOT NULL,
    "status" "TourPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "actedAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tour_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_plan_days" (
    "id" SERIAL NOT NULL,
    "tourPlanId" INTEGER NOT NULL,
    "planDate" DATE NOT NULL,
    "territoryId" INTEGER,
    "workType" "WorkType" NOT NULL DEFAULT 'FIELD',
    "jointWithUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_plan_calls" (
    "id" SERIAL NOT NULL,
    "tourPlanDayId" INTEGER NOT NULL,
    "doctorId" INTEGER,
    "chemistId" INTEGER,

    CONSTRAINT "tour_plan_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "mrId" INTEGER NOT NULL,
    "assignedById" INTEGER,
    "date" DATE NOT NULL,
    "time" TIME(0) NOT NULL,
    "slotEnd" TIME(0),
    "purpose" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "rescheduleOf" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER,
    "doctorId" INTEGER,
    "chemistId" INTEGER,
    "mrId" INTEGER NOT NULL,
    "visitDate" DATE NOT NULL,
    "visitTime" TIME(0) NOT NULL,
    "checkInTime" TIME(0),
    "checkOutTime" TIME(0),
    "meetingDurationMin" INTEGER,
    "inLat" DOUBLE PRECISION,
    "inLng" DOUBLE PRECISION,
    "distanceFromClinicM" INTEGER,
    "discussionNotes" TEXT,
    "doctorFeedback" TEXT,
    "visitOutcome" TEXT,
    "nextFollowUp" DATE,
    "photoUrl" TEXT,
    "remarks" TEXT,
    "clientUuid" TEXT,
    "lockedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_products" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "detailSeq" INTEGER NOT NULL DEFAULT 1,
    "interestLevel" TEXT,
    "prescriptionExpected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "visit_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "doctorId" INTEGER,
    "medicalStoreId" INTEGER,
    "medicineId" INTEGER NOT NULL,
    "mrId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "invoiceNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- CreateIndex
CREATE INDEX "users_territoryId_idx" ON "users"("territoryId");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "mr_profiles_userId_key" ON "mr_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mr_profiles_employeeCode_key" ON "mr_profiles"("employeeCode");

-- CreateIndex
CREATE INDEX "mr_profiles_employeeCode_idx" ON "mr_profiles"("employeeCode");

-- CreateIndex
CREATE INDEX "mr_profiles_assignedArea_idx" ON "mr_profiles"("assignedArea");

-- CreateIndex
CREATE INDEX "mr_profiles_deletedAt_idx" ON "mr_profiles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "territories_parentId_idx" ON "territories"("parentId");

-- CreateIndex
CREATE INDEX "territories_type_idx" ON "territories"("type");

-- CreateIndex
CREATE INDEX "territories_status_idx" ON "territories"("status");

-- CreateIndex
CREATE INDEX "territories_deletedAt_idx" ON "territories"("deletedAt");

-- CreateIndex
CREATE INDEX "doctors_fullName_idx" ON "doctors"("fullName");

-- CreateIndex
CREATE INDEX "doctors_city_idx" ON "doctors"("city");

-- CreateIndex
CREATE INDEX "doctors_category_idx" ON "doctors"("category");

-- CreateIndex
CREATE INDEX "doctors_territoryId_idx" ON "doctors"("territoryId");

-- CreateIndex
CREATE INDEX "doctors_status_idx" ON "doctors"("status");

-- CreateIndex
CREATE INDEX "doctors_deletedAt_idx" ON "doctors"("deletedAt");

-- CreateIndex
CREATE INDEX "doctor_assignments_mrId_idx" ON "doctor_assignments"("mrId");

-- CreateIndex
CREATE INDEX "doctor_assignments_doctorId_idx" ON "doctor_assignments"("doctorId");

-- CreateIndex
CREATE INDEX "doctor_assignments_isActive_idx" ON "doctor_assignments"("isActive");

-- CreateIndex
CREATE INDEX "doctor_assignments_deletedAt_idx" ON "doctor_assignments"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_assignments_doctorId_mrId_key" ON "doctor_assignments"("doctorId", "mrId");

-- CreateIndex
CREATE INDEX "medical_stores_name_idx" ON "medical_stores"("name");

-- CreateIndex
CREATE INDEX "medical_stores_type_idx" ON "medical_stores"("type");

-- CreateIndex
CREATE INDEX "medical_stores_gstNumber_idx" ON "medical_stores"("gstNumber");

-- CreateIndex
CREATE INDEX "medical_stores_territoryId_idx" ON "medical_stores"("territoryId");

-- CreateIndex
CREATE INDEX "medical_stores_status_idx" ON "medical_stores"("status");

-- CreateIndex
CREATE INDEX "medical_stores_deletedAt_idx" ON "medical_stores"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_code_key" ON "medicines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_sku_key" ON "medicines"("sku");

-- CreateIndex
CREATE INDEX "medicines_name_idx" ON "medicines"("name");

-- CreateIndex
CREATE INDEX "medicines_category_idx" ON "medicines"("category");

-- CreateIndex
CREATE INDEX "medicines_company_idx" ON "medicines"("company");

-- CreateIndex
CREATE INDEX "medicines_status_idx" ON "medicines"("status");

-- CreateIndex
CREATE INDEX "medicines_deletedAt_idx" ON "medicines"("deletedAt");

-- CreateIndex
CREATE INDEX "batches_medicineId_idx" ON "batches"("medicineId");

-- CreateIndex
CREATE INDEX "batches_expiryDate_idx" ON "batches"("expiryDate");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_deletedAt_idx" ON "batches"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "batches_medicineId_batchNo_key" ON "batches"("medicineId", "batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "stock_txns_txnNo_key" ON "stock_txns"("txnNo");

-- CreateIndex
CREATE UNIQUE INDEX "stock_txns_clientUuid_key" ON "stock_txns"("clientUuid");

-- CreateIndex
CREATE INDEX "stock_txns_txnType_idx" ON "stock_txns"("txnType");

-- CreateIndex
CREATE INDEX "stock_txns_txnDate_idx" ON "stock_txns"("txnDate");

-- CreateIndex
CREATE INDEX "stock_txns_medicineId_idx" ON "stock_txns"("medicineId");

-- CreateIndex
CREATE INDEX "stock_txns_batchId_idx" ON "stock_txns"("batchId");

-- CreateIndex
CREATE INDEX "stock_txns_fromHolderType_fromHolderId_idx" ON "stock_txns"("fromHolderType", "fromHolderId");

-- CreateIndex
CREATE INDEX "stock_txns_toHolderType_toHolderId_idx" ON "stock_txns"("toHolderType", "toHolderId");

-- CreateIndex
CREATE INDEX "stock_txns_refType_refId_idx" ON "stock_txns"("refType", "refId");

-- CreateIndex
CREATE INDEX "stock_txns_createdAt_idx" ON "stock_txns"("createdAt");

-- CreateIndex
CREATE INDEX "stock_balances_holderType_holderId_idx" ON "stock_balances"("holderType", "holderId");

-- CreateIndex
CREATE INDEX "stock_balances_medicineId_idx" ON "stock_balances"("medicineId");

-- CreateIndex
CREATE INDEX "stock_balances_batchId_idx" ON "stock_balances"("batchId");

-- CreateIndex
CREATE INDEX "stock_balances_qty_idx" ON "stock_balances"("qty");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_holderType_holderId_medicineId_batchId_key" ON "stock_balances"("holderType", "holderId", "medicineId", "batchId");

-- CreateIndex
CREATE INDEX "stock_counts_userId_idx" ON "stock_counts"("userId");

-- CreateIndex
CREATE INDEX "stock_counts_countDate_idx" ON "stock_counts"("countDate");

-- CreateIndex
CREATE INDEX "stock_counts_deletedAt_idx" ON "stock_counts"("deletedAt");

-- CreateIndex
CREATE INDEX "stock_count_items_countId_idx" ON "stock_count_items"("countId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_items_countId_medicineId_batchId_key" ON "stock_count_items"("countId", "medicineId", "batchId");

-- CreateIndex
CREATE INDEX "attendances_userId_idx" ON "attendances"("userId");

-- CreateIndex
CREATE INDEX "attendances_attDate_idx" ON "attendances"("attDate");

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status");

-- CreateIndex
CREATE INDEX "attendances_deletedAt_idx" ON "attendances"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_userId_attDate_key" ON "attendances"("userId", "attDate");

-- CreateIndex
CREATE INDEX "tour_plans_status_idx" ON "tour_plans"("status");

-- CreateIndex
CREATE INDEX "tour_plans_deletedAt_idx" ON "tour_plans"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tour_plans_userId_planMonth_key" ON "tour_plans"("userId", "planMonth");

-- CreateIndex
CREATE INDEX "tour_plan_days_planDate_idx" ON "tour_plan_days"("planDate");

-- CreateIndex
CREATE UNIQUE INDEX "tour_plan_days_tourPlanId_planDate_key" ON "tour_plan_days"("tourPlanId", "planDate");

-- CreateIndex
CREATE INDEX "tour_plan_calls_tourPlanDayId_idx" ON "tour_plan_calls"("tourPlanDayId");

-- CreateIndex
CREATE INDEX "tour_plan_calls_doctorId_idx" ON "tour_plan_calls"("doctorId");

-- CreateIndex
CREATE INDEX "tour_plan_calls_chemistId_idx" ON "tour_plan_calls"("chemistId");

-- CreateIndex
CREATE INDEX "appointments_doctorId_idx" ON "appointments"("doctorId");

-- CreateIndex
CREATE INDEX "appointments_mrId_idx" ON "appointments"("mrId");

-- CreateIndex
CREATE INDEX "appointments_assignedById_idx" ON "appointments"("assignedById");

-- CreateIndex
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_deletedAt_idx" ON "appointments"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "visits_appointmentId_key" ON "visits"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "visits_clientUuid_key" ON "visits"("clientUuid");

-- CreateIndex
CREATE INDEX "visits_doctorId_idx" ON "visits"("doctorId");

-- CreateIndex
CREATE INDEX "visits_mrId_idx" ON "visits"("mrId");

-- CreateIndex
CREATE INDEX "visits_visitDate_idx" ON "visits"("visitDate");

-- CreateIndex
CREATE INDEX "visits_deletedAt_idx" ON "visits"("deletedAt");

-- CreateIndex
CREATE INDEX "visit_products_visitId_idx" ON "visit_products"("visitId");

-- CreateIndex
CREATE INDEX "visit_products_medicineId_idx" ON "visit_products"("medicineId");

-- CreateIndex
CREATE INDEX "visit_products_deletedAt_idx" ON "visit_products"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "visit_products_visitId_medicineId_key" ON "visit_products"("visitId", "medicineId");

-- CreateIndex
CREATE INDEX "sales_mrId_idx" ON "sales"("mrId");

-- CreateIndex
CREATE INDEX "sales_medicineId_idx" ON "sales"("medicineId");

-- CreateIndex
CREATE INDEX "sales_doctorId_idx" ON "sales"("doctorId");

-- CreateIndex
CREATE INDEX "sales_medicalStoreId_idx" ON "sales"("medicalStoreId");

-- CreateIndex
CREATE INDEX "sales_invoiceDate_idx" ON "sales"("invoiceDate");

-- CreateIndex
CREATE INDEX "sales_deletedAt_idx" ON "sales"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_group_idx" ON "settings"("group");

-- CreateIndex
CREATE INDEX "settings_deletedAt_idx" ON "settings"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_status_idx" ON "warehouses"("status");

-- CreateIndex
CREATE INDEX "warehouses_deletedAt_idx" ON "warehouses"("deletedAt");

-- CreateIndex
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mr_profiles" ADD CONSTRAINT "mr_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_assignments" ADD CONSTRAINT "doctor_assignments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_assignments" ADD CONSTRAINT "doctor_assignments_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_stores" ADD CONSTRAINT "medical_stores_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_txns" ADD CONSTRAINT "stock_txns_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_txns" ADD CONSTRAINT "stock_txns_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_txns" ADD CONSTRAINT "stock_txns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plans" ADD CONSTRAINT "tour_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plans" ADD CONSTRAINT "tour_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_days" ADD CONSTRAINT "tour_plan_days_tourPlanId_fkey" FOREIGN KEY ("tourPlanId") REFERENCES "tour_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_days" ADD CONSTRAINT "tour_plan_days_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_days" ADD CONSTRAINT "tour_plan_days_jointWithUserId_fkey" FOREIGN KEY ("jointWithUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_calls" ADD CONSTRAINT "tour_plan_calls_tourPlanDayId_fkey" FOREIGN KEY ("tourPlanDayId") REFERENCES "tour_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_calls" ADD CONSTRAINT "tour_plan_calls_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plan_calls" ADD CONSTRAINT "tour_plan_calls_chemistId_fkey" FOREIGN KEY ("chemistId") REFERENCES "medical_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduleOf_fkey" FOREIGN KEY ("rescheduleOf") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_products" ADD CONSTRAINT "visit_products_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_products" ADD CONSTRAINT "visit_products_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "medical_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_mrId_fkey" FOREIGN KEY ("mrId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
