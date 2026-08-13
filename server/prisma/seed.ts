import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_MR_PERMISSIONS,
} from '../src/constants/permissions';

/**
 * Field Force demo seed — Admin → Manager → MRs, batches, append-only stock_txns.
 */

async function seedRolePermissions(prisma: PrismaClient): Promise<void> {
  const rows: { role: 'ADMIN' | 'MANAGER' | 'MR'; permission: string }[] = [
    ...DEFAULT_ADMIN_PERMISSIONS.map((permission) => ({ role: 'ADMIN' as const, permission })),
    ...DEFAULT_MANAGER_PERMISSIONS.map((permission) => ({
      role: 'MANAGER' as const,
      permission,
    })),
    ...DEFAULT_MR_PERMISSIONS.map((permission) => ({ role: 'MR' as const, permission })),
  ];

  for (const row of rows) {
    await prisma.rolePermission.upsert({
      where: { role_permission: { role: row.role, permission: row.permission } },
      create: row,
      update: {},
    });
  }
}

function dateOnly(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function timeAt(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const adminHash = await bcrypt.hash('Admin@12345', saltRounds);
  const managerHash = await bcrypt.hash('Manager@12345', saltRounds);
  const mrHash = await bcrypt.hash('Mr@12345', saltRounds);

  let txnSeq = 1;
  const nextTxnNo = (): string => `TXN-${String(txnSeq++).padStart(6, '0')}`;

  try {
    console.log('Seeding Field Force demo…');

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        stock_count_items,
        stock_counts,
        stock_balances,
        stock_txns,
        visit_products,
        visits,
        appointments,
        tour_plan_calls,
        tour_plan_days,
        tour_plans,
        attendances,
        sales,
        doctor_assignments,
        batches,
        medicines,
        medical_stores,
        doctors,
        warehouses,
        mr_profiles,
        refresh_tokens,
        audit_logs,
        users,
        territories,
        settings
      RESTART IDENTITY CASCADE;
    `);

    const state = await prisma.territory.create({
      data: { name: 'Gujarat', type: 'STATE', status: 'ACTIVE' },
    });
    const district = await prisma.territory.create({
      data: { name: 'Ahmedabad', type: 'DISTRICT', parentId: state.id, status: 'ACTIVE' },
    });
    const hq = await prisma.territory.create({
      data: { name: 'Ahmedabad HQ', type: 'HQ', parentId: district.id, status: 'ACTIVE' },
    });
    const beatCentral = await prisma.territory.create({
      data: { name: 'Ahmedabad Central', type: 'BEAT', parentId: hq.id, status: 'ACTIVE' },
    });
    const beatWest = await prisma.territory.create({
      data: { name: 'Ahmedabad West', type: 'BEAT', parentId: hq.id, status: 'ACTIVE' },
    });

    const warehouse = await prisma.warehouse.create({
      data: { name: 'JOVANCE Central Warehouse', code: 'WH-AHM-01', city: 'Ahmedabad', status: 'ACTIVE' },
    });

    const admin = await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL ?? 'admin@pharma-mr.local',
        passwordHash: adminHash,
        fullName: process.env.ADMIN_NAME ?? 'Suresh Mehta',
        phone: '9876500001',
        role: 'ADMIN',
        status: 'ACTIVE',
        territoryId: hq.id,
      },
    });

    const manager = await prisma.user.create({
      data: {
        email: 'asm.west@jovance.local',
        passwordHash: managerHash,
        fullName: 'Ankit Shah (ASM)',
        phone: '9876500010',
        role: 'MANAGER',
        status: 'ACTIVE',
        managerId: admin.id,
        territoryId: hq.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    await prisma.setting.createMany({
      data: [
        { key: 'company.name', value: 'JOVANCE LABORATORIES PVT. LTD.', group: 'branding' },
        { key: 'company.shortName', value: 'JOVANCE', group: 'branding' },
        { key: 'stock.default_warehouse_id', value: String(warehouse.id), group: 'stock' },
      ],
    });

    const mrDefs = [
      { fullName: 'Rahul Sharma', email: 'rahul.mr@jovance.local', code: 'MR-AHM-01', area: 'Ahmedabad Central', beatId: beatCentral.id, phone: '9876510001' },
      { fullName: 'Priya Patel', email: 'priya.mr@jovance.local', code: 'MR-AHM-02', area: 'Ahmedabad West', beatId: beatWest.id, phone: '9876510002' },
      { fullName: 'Amit Kumar', email: 'amit.mr@jovance.local', code: 'MR-SUR-01', area: 'Surat', beatId: beatCentral.id, phone: '9876510003' },
    ];

    const mrs = [];
    for (const mr of mrDefs) {
      const user = await prisma.user.create({
        data: {
          email: mr.email,
          passwordHash: mrHash,
          fullName: mr.fullName,
          phone: mr.phone,
          role: 'MR',
          status: 'ACTIVE',
          managerId: manager.id,
          territoryId: mr.beatId,
          createdBy: admin.id,
          updatedBy: admin.id,
          mrProfile: {
            create: {
              employeeCode: mr.code,
              assignedArea: mr.area,
              address: `${mr.area}, Gujarat`,
              joiningDate: dateOnly(-400),
              createdBy: admin.id,
              updatedBy: admin.id,
            },
          },
        },
      });
      mrs.push(user);
    }

    const doctorNames = [
      'Dr. Anil Shah', 'Dr. Meera Joshi', 'Dr. Rakesh Trivedi', 'Dr. Kavita Iyer',
      'Dr. Sandeep Rao', 'Dr. Pooja Nair', 'Dr. Harshad Bhatt', 'Dr. Sunita Reddy',
    ];
    const specializations = ['Cardiology', 'General Medicine', 'Orthopaedics', 'Pediatrics', 'Dermatology', 'Diabetology', 'ENT', 'Neurology'];
    const categories = ['A', 'B', 'C'] as const;

    const doctors = [];
    for (let i = 0; i < doctorNames.length; i++) {
      const doctor = await prisma.doctor.create({
        data: {
          fullName: doctorNames[i]!,
          specialization: specializations[i % specializations.length],
          category: categories[i % categories.length],
          hospital: 'Civil Hospital',
          clinic: `${doctorNames[i]!.replace('Dr. ', '')} Clinic`,
          phone: `98${String(76520000 + i).padStart(8, '0')}`,
          city: 'Ahmedabad',
          territoryId: i % 2 === 0 ? beatCentral.id : beatWest.id,
          visitFreqPm: 2 + (i % 3),
          visitingDays: 'Mon, Wed, Fri',
          preferredTime: '10:00-13:00',
          status: 'ACTIVE',
          approvedBy: manager.id,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });
      doctors.push(doctor);
      const mr = mrs[i % mrs.length]!;
      await prisma.doctorAssignment.create({
        data: {
          doctorId: doctor.id,
          mrId: mr.id,
          isActive: true,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });
    }

    const store = await prisma.medicalStore.create({
      data: {
        name: 'Shree Medical Stores',
        type: 'CHEMIST',
        ownerName: 'Jignesh Patel',
        city: 'Ahmedabad',
        phone: '794000001',
        gstNumber: '24AABC1001L1Z1',
        drugLicenseNumber: 'GJ-DL-2001',
        territoryId: beatCentral.id,
        status: 'ACTIVE',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    const medicineDefs = [
      { name: 'Zincoboom 500', brand: 'Zincoboom', generic: 'Zinc Acetate', strength: '500mg', category: 'Nutraceutical', mrp: 185 },
      { name: 'Calciplus Softgel', brand: 'Calciplus', generic: 'Calcium + D3', strength: 'OD', category: 'Nutraceutical', mrp: 175 },
      { name: 'Neurovit Forte', brand: 'Neurovit', generic: 'Methylcobalamin', strength: '1500mcg', category: 'Neuro', mrp: 210 },
      { name: 'Jovance Pantoprazole', brand: 'PantoJov', generic: 'Pantoprazole', strength: '40mg', category: 'Gastro', mrp: 95 },
      { name: 'Jovance Cefixime', brand: 'CefiJov', generic: 'Cefixime', strength: '200mg', category: 'Antibiotic', mrp: 185 },
    ];

    const medicines = [];
    for (let i = 0; i < medicineDefs.length; i++) {
      const m = medicineDefs[i]!;
      const medicine = await prisma.medicine.create({
        data: {
          name: m.name,
          code: `JOV-${1000 + i}`,
          brandName: m.brand,
          genericName: m.generic,
          company: 'JOVANCE LABORATORIES PVT. LTD.',
          composition: m.generic,
          strength: m.strength,
          category: m.category,
          packSize: '10x10',
          mrp: m.mrp,
          sku: `SKU-${1000 + i}`,
          sampleAvailable: true,
          status: 'ACTIVE',
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });
      const batch = await prisma.batch.create({
        data: {
          medicineId: medicine.id,
          batchNo: `B2026${String(i + 1).padStart(3, '0')}`,
          mfgDate: dateOnly(-180),
          expiryDate: dateOnly(300 + i * 30),
          status: 'ACTIVE',
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });
      medicines.push({ medicine, batch });

      // Warehouse opening
      const openingQty = 1000;
      await prisma.stockTxn.create({
        data: {
          txnNo: nextTxnNo(),
          txnType: 'OPENING',
          txnDate: dateOnly(-60),
          medicineId: medicine.id,
          batchId: batch.id,
          qty: openingQty,
          toHolderType: 'WAREHOUSE',
          toHolderId: warehouse.id,
          refType: 'MANUAL',
          note: 'Opening stock',
          createdBy: admin.id,
        },
      });
      await prisma.stockBalance.create({
        data: {
          holderType: 'WAREHOUSE',
          holderId: warehouse.id,
          medicineId: medicine.id,
          batchId: batch.id,
          qty: openingQty,
        },
      });

      // Transfer to manager
      const transferQty = 200;
      await prisma.stockTxn.create({
        data: {
          txnNo: nextTxnNo(),
          txnType: 'TRANSFER',
          txnDate: dateOnly(-30),
          medicineId: medicine.id,
          batchId: batch.id,
          qty: transferQty,
          fromHolderType: 'WAREHOUSE',
          fromHolderId: warehouse.id,
          toHolderType: 'USER',
          toHolderId: manager.id,
          refType: 'MANUAL',
          note: 'ASM area stock',
          createdBy: admin.id,
        },
      });
      await prisma.stockBalance.update({
        where: {
          holderType_holderId_medicineId_batchId: {
            holderType: 'WAREHOUSE',
            holderId: warehouse.id,
            medicineId: medicine.id,
            batchId: batch.id,
          },
        },
        data: { qty: { decrement: transferQty } },
      });
      await prisma.stockBalance.create({
        data: {
          holderType: 'USER',
          holderId: manager.id,
          medicineId: medicine.id,
          batchId: batch.id,
          qty: transferQty,
        },
      });
    }

    // ISSUE to each MR from manager bag
    for (const mr of mrs) {
      for (let i = 0; i < medicines.length; i++) {
        const { medicine, batch } = medicines[i]!;
        const qty = 30 + i * 5;
        await prisma.stockTxn.create({
          data: {
            txnNo: nextTxnNo(),
            txnType: 'ISSUE',
            txnDate: dateOnly(-20 + i),
            medicineId: medicine.id,
            batchId: batch.id,
            qty,
            fromHolderType: 'USER',
            fromHolderId: manager.id,
            toHolderType: 'USER',
            toHolderId: mr.id,
            refType: 'ISSUE',
            note: 'Field sample allocation',
            createdBy: manager.id,
          },
        });
        await prisma.stockBalance.update({
          where: {
            holderType_holderId_medicineId_batchId: {
              holderType: 'USER',
              holderId: manager.id,
              medicineId: medicine.id,
              batchId: batch.id,
            },
          },
          data: { qty: { decrement: qty } },
        });
        await prisma.stockBalance.create({
          data: {
            holderType: 'USER',
            holderId: mr.id,
            medicineId: medicine.id,
            batchId: batch.id,
            qty,
          },
        });
      }
    }

    // Tour plan for first MR (approved)
    const plan = await prisma.tourPlan.create({
      data: {
        userId: mrs[0]!.id,
        planMonth: monthStart(),
        status: 'APPROVED',
        submittedAt: dateOnly(-5),
        approvedById: manager.id,
        actedAt: dateOnly(-4),
        createdBy: mrs[0]!.id,
        updatedBy: manager.id,
      },
    });
    const day = await prisma.tourPlanDay.create({
      data: {
        tourPlanId: plan.id,
        planDate: dateOnly(0),
        territoryId: beatCentral.id,
        workType: 'FIELD',
      },
    });
    await prisma.tourPlanCall.create({
      data: { tourPlanDayId: day.id, doctorId: doctors[0]!.id },
    });
    await prisma.tourPlanCall.create({
      data: { tourPlanDayId: day.id, doctorId: doctors[1]!.id },
    });

    // Appointments + visits + SAMPLE_GIVEN ledger rows
    for (let i = 0; i < 12; i++) {
      const doctor = doctors[i % doctors.length]!;
      const assignment = await prisma.doctorAssignment.findFirst({
        where: { doctorId: doctor.id, isActive: true },
      });
      const mrId = assignment?.mrId ?? mrs[0]!.id;
      const status = i < 3 ? 'PENDING' : 'COMPLETED';
      const appt = await prisma.appointment.create({
        data: {
          doctorId: doctor.id,
          mrId,
          date: dateOnly(status === 'PENDING' ? i : -(i + 1)),
          time: timeAt(10 + (i % 5), 0),
          purpose: 'Product detailing',
          status,
          createdBy: mrId,
          updatedBy: mrId,
        },
      });

      if (status !== 'COMPLETED') continue;

      const visit = await prisma.visit.create({
        data: {
          appointmentId: appt.id,
          doctorId: doctor.id,
          mrId,
          visitDate: appt.date,
          visitTime: timeAt(10 + (i % 5), 0),
          checkInTime: timeAt(10 + (i % 5), 0),
          checkOutTime: timeAt(10 + (i % 5), 35),
          meetingDurationMin: 35,
          discussionNotes: 'Discussed dosage and compliance.',
          doctorFeedback: 'Interested in OPD samples',
          nextFollowUp: dateOnly(7),
          clientUuid: `seed-visit-${i}`,
          createdBy: mrId,
          updatedBy: mrId,
        },
      });

      const { medicine, batch } = medicines[i % medicines.length]!;
      await prisma.visitProduct.create({
        data: {
          visitId: visit.id,
          medicineId: medicine.id,
          detailSeq: 1,
          interestLevel: 'MEDIUM',
          prescriptionExpected: true,
          notes: 'Detailed',
          createdBy: mrId,
          updatedBy: mrId,
        },
      });

      const sampleQty = 4;
      const bal = await prisma.stockBalance.findUnique({
        where: {
          holderType_holderId_medicineId_batchId: {
            holderType: 'USER',
            holderId: mrId,
            medicineId: medicine.id,
            batchId: batch.id,
          },
        },
      });
      if (bal && bal.qty >= sampleQty) {
        await prisma.stockTxn.create({
          data: {
            txnNo: nextTxnNo(),
            txnType: 'SAMPLE_GIVEN',
            txnDate: visit.visitDate,
            medicineId: medicine.id,
            batchId: batch.id,
            qty: sampleQty,
            fromHolderType: 'USER',
            fromHolderId: mrId,
            toHolderType: 'DOCTOR',
            toHolderId: doctor.id,
            refType: 'VISIT',
            refId: visit.id,
            note: 'OPD sample',
            createdBy: mrId,
          },
        });
        await prisma.stockBalance.update({
          where: {
            holderType_holderId_medicineId_batchId: {
              holderType: 'USER',
              holderId: mrId,
              medicineId: medicine.id,
              batchId: batch.id,
            },
          },
          data: { qty: { decrement: sampleQty } },
        });
      }
    }

    // Attendance
    for (const mr of mrs) {
      for (let d = 1; d <= 10; d++) {
        const attDate = dateOnly(-d);
        const checkInAt = new Date(attDate);
        checkInAt.setUTCHours(9, 15, 0, 0);
        const checkOutAt = new Date(attDate);
        checkOutAt.setUTCHours(18, 0, 0, 0);
        await prisma.attendance.create({
          data: {
            userId: mr.id,
            attDate,
            checkInAt,
            checkOutAt,
            workingMins: 525,
            inLat: 23.0225,
            inLng: 72.5714,
            accuracyM: 25,
            isMockLocation: false,
            serverAt: checkInAt,
            status: 'PRESENT',
            createdBy: mr.id,
            updatedBy: mr.id,
          },
        });
      }
    }

    await prisma.sale.create({
      data: {
        mrId: mrs[0]!.id,
        medicineId: medicines[0]!.medicine.id,
        medicalStoreId: store.id,
        quantity: 10,
        amount: Number(medicines[0]!.medicine.mrp) * 10 * 0.85,
        invoiceDate: dateOnly(-2),
        invoiceNumber: 'INV-2026-1001',
        createdBy: mrs[0]!.id,
        updatedBy: mrs[0]!.id,
      },
    });

    await seedRolePermissions(prisma);

    console.log('Seed complete:');
    console.log(`  Admin:   ${admin.email} / Admin@12345`);
    console.log(`  Manager: ${manager.email} / Manager@12345`);
    console.log(`  MR:      ${mrs[0]!.email} / Mr@12345`);
    console.log(`  Territories / warehouse / batches / stock_txns seeded`);
    console.log(`  Role default permissions seeded`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
