import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Realistic Indian Pharma CRM demo seed.
 * Creates connected Admin → MR → Doctor → Appointment → Visit → Samples → Sales data.
 */

function dateOnly(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function timeAt(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for seeding');

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash('Admin@12345', saltRounds);
  const mrPasswordHash = await bcrypt.hash('Mr@12345', saltRounds);

  try {
    console.log('Seeding JOVANCE Pharma MR CRM demo data…');

    // Clean transactional tables for idempotent demo reseed (keep order for FKs)
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        medicine_distributions,
        visit_products,
        visits,
        appointments,
        medicine_issues,
        mr_stocks,
        stock_movements,
        sales,
        attendances,
        doctor_assignments,
        medicine_purchases,
        stocks,
        medicines,
        medical_stores,
        doctors,
        mr_profiles,
        refresh_tokens,
        audit_logs,
        users,
        settings
      RESTART IDENTITY CASCADE;
    `);

    const admin = await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL ?? 'admin@pharma-mr.local',
        passwordHash,
        fullName: process.env.ADMIN_NAME ?? 'Suresh Mehta',
        phone: '9876500001',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await prisma.setting.createMany({
      data: [
        { key: 'company.name', value: 'JOVANCE LABORATORIES PVT. LTD.', group: 'branding' },
        { key: 'company.shortName', value: 'JOVANCE', group: 'branding' },
        { key: 'company.city', value: 'Ahmedabad', group: 'branding' },
      ],
    });

    const mrDefs = [
      { fullName: 'Rahul Sharma', email: 'rahul.mr@jovance.local', code: 'MR-AHM-01', area: 'Ahmedabad Central', phone: '9876510001' },
      { fullName: 'Priya Patel', email: 'priya.mr@jovance.local', code: 'MR-AHM-02', area: 'Ahmedabad West', phone: '9876510002' },
      { fullName: 'Amit Kumar', email: 'amit.mr@jovance.local', code: 'MR-SUR-01', area: 'Surat', phone: '9876510003' },
      { fullName: 'Neha Desai', email: 'neha.mr@jovance.local', code: 'MR-VAD-01', area: 'Vadodara', phone: '9876510004' },
      { fullName: 'Vikram Singh', email: 'vikram.mr@jovance.local', code: 'MR-RAJ-01', area: 'Rajkot', phone: '9876510005' },
    ];

    const mrs = [];
    for (const mr of mrDefs) {
      const user = await prisma.user.create({
        data: {
          email: mr.email,
          passwordHash: mrPasswordHash,
          fullName: mr.fullName,
          phone: mr.phone,
          role: 'MR',
          status: 'ACTIVE',
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

    const hospitals = [
      'Civil Hospital',
      'Apollo Hospitals',
      'Sterling Hospital',
      'HCG Cancer Centre',
      'Zydus Hospital',
      'Shalby Hospital',
      'KD Hospital',
      'CIMS Hospital',
    ];
    const specializations = [
      'Cardiology',
      'General Medicine',
      'Orthopaedics',
      'Pediatrics',
      'Dermatology',
      'Diabetology',
      'Gynecology',
      'ENT',
      'Neurology',
      'Pulmonology',
    ];
    const cities = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];
    const doctorNames = [
      'Dr. Anil Shah', 'Dr. Meera Joshi', 'Dr. Rakesh Trivedi', 'Dr. Kavita Iyer', 'Dr. Sandeep Rao',
      'Dr. Pooja Nair', 'Dr. Harshad Bhatt', 'Dr. Sunita Reddy', 'Dr. Manoj Gupta', 'Dr. Asha Verma',
      'Dr. Nikhil Parekh', 'Dr. Ritu Malhotra', 'Dr. Deepak Chauhan', 'Dr. Shalini Menon', 'Dr. Yogesh Solanki',
      'Dr. Farah Khan', 'Dr. Girish Dave', 'Dr. Latika Jain', 'Dr. Pratik Oza', 'Dr. Nidhi Kapoor',
    ];

    const doctors = [];
    for (let i = 0; i < doctorNames.length; i++) {
      const doctor = await prisma.doctor.create({
        data: {
          fullName: doctorNames[i]!,
          specialization: specializations[i % specializations.length],
          hospital: hospitals[i % hospitals.length],
          clinic: `${doctorNames[i]!.replace('Dr. ', '')} Clinic`,
          phone: `98${String(76520000 + i).padStart(8, '0')}`,
          city: cities[i % cities.length],
          visitingDays: 'Mon, Wed, Fri',
          preferredTime: '10:00-13:00',
          status: 'ACTIVE',
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

    const storeDefs = [
      { name: 'Shree Medical Stores', city: 'Ahmedabad', owner: 'Jignesh Patel' },
      { name: 'Apollo Pharmacy Satellite', city: 'Ahmedabad', owner: 'Apollo Retail' },
      { name: 'MedPlus Paldi', city: 'Ahmedabad', owner: 'MedPlus' },
      { name: 'Wellness Forever CG Road', city: 'Ahmedabad', owner: 'Wellness Forever' },
      { name: 'Surat Chemist Hub', city: 'Surat', owner: 'Kiran Shah' },
      { name: 'Ring Road Medical', city: 'Surat', owner: 'Bhavna Desai' },
      { name: 'Alkapuri Pharma', city: 'Vadodara', owner: 'Rajesh Mehta' },
      { name: 'Race Course Medicals', city: 'Vadodara', owner: 'Nilesh Rana' },
      { name: 'Kalavad Road Pharmacy', city: 'Rajkot', owner: 'Hardik Joshi' },
      { name: 'Gandhinagar Jan Aushadhi', city: 'Gandhinagar', owner: 'Co-op Society' },
    ];
    const stores = [];
    for (let i = 0; i < storeDefs.length; i++) {
      const s = storeDefs[i]!;
      stores.push(
        await prisma.medicalStore.create({
          data: {
            name: s.name,
            ownerName: s.owner,
            city: s.city,
            phone: `79${String(4000000 + i).padStart(7, '0')}`,
            gstNumber: `24AABC${1000 + i}L1Z${i % 9}`,
            drugLicenseNumber: `GJ-DL-${2000 + i}`,
            status: 'ACTIVE',
            createdBy: admin.id,
            updatedBy: admin.id,
          },
        }),
      );
    }

    const medicineDefs = [
      { name: 'Jovance Cefixime', brand: 'CefiJov', generic: 'Cefixime', strength: '200mg', category: 'Antibiotic', mrp: 185 },
      { name: 'Jovance Azithromycin', brand: 'AziJov', generic: 'Azithromycin', strength: '500mg', category: 'Antibiotic', mrp: 120 },
      { name: 'Jovance Pantoprazole', brand: 'PantoJov', generic: 'Pantoprazole', strength: '40mg', category: 'Gastro', mrp: 95 },
      { name: 'Jovance Domperidone', brand: 'DomJov', generic: 'Domperidone', strength: '10mg', category: 'Gastro', mrp: 68 },
      { name: 'Jovance Metformin', brand: 'MetJov', generic: 'Metformin', strength: '500mg', category: 'Diabetes', mrp: 75 },
      { name: 'Jovance Glimepiride', brand: 'GlimJov', generic: 'Glimepiride', strength: '2mg', category: 'Diabetes', mrp: 110 },
      { name: 'Jovance Amlodipine', brand: 'AmloJov', generic: 'Amlodipine', strength: '5mg', category: 'Cardiac', mrp: 88 },
      { name: 'Jovance Telmisartan', brand: 'TelmiJov', generic: 'Telmisartan', strength: '40mg', category: 'Cardiac', mrp: 145 },
      { name: 'Jovance Atorvastatin', brand: 'AtorJov', generic: 'Atorvastatin', strength: '10mg', category: 'Cardiac', mrp: 160 },
      { name: 'Jovance Paracetamol', brand: 'ParaJov', generic: 'Paracetamol', strength: '650mg', category: 'Analgesic', mrp: 35 },
      { name: 'Jovance Aceclofenac', brand: 'AceJov', generic: 'Aceclofenac', strength: '100mg', category: 'Analgesic', mrp: 72 },
      { name: 'Jovance Diclofenac Gel', brand: 'DicloJov', generic: 'Diclofenac', strength: '1%', category: 'Analgesic', mrp: 95 },
      { name: 'Jovance Montelukast', brand: 'MontJov', generic: 'Montelukast', strength: '10mg', category: 'Respiratory', mrp: 130 },
      { name: 'Jovance Levocetirizine', brand: 'LevoJov', generic: 'Levocetirizine', strength: '5mg', category: 'Respiratory', mrp: 55 },
      { name: 'Jovance Amoxicillin-Clav', brand: 'ClavJov', generic: 'Amoxicillin + Clavulanate', strength: '625mg', category: 'Antibiotic', mrp: 210 },
      { name: 'Jovance Ondansetron', brand: 'OndanJov', generic: 'Ondansetron', strength: '4mg', category: 'Gastro', mrp: 48 },
      { name: 'Jovance Multivitamin', brand: 'VitaJov', generic: 'Multivitamins', strength: 'OD', category: 'Nutraceutical', mrp: 220 },
      { name: 'Jovance Calcium-D3', brand: 'CalciJov', generic: 'Calcium + Vitamin D3', strength: '500mg', category: 'Nutraceutical', mrp: 175 },
      { name: 'Jovance Iron Folate', brand: 'FerroJov', generic: 'Ferrous Ascorbate + Folic Acid', strength: 'OD', category: 'Nutraceutical', mrp: 140 },
      { name: 'Jovance Rabeprazole', brand: 'RabeJov', generic: 'Rabeprazole', strength: '20mg', category: 'Gastro', mrp: 105 },
      { name: 'Jovance Cefpodoxime', brand: 'CefpoJov', generic: 'Cefpodoxime', strength: '200mg', category: 'Antibiotic', mrp: 195 },
      { name: 'Jovance Losartan', brand: 'LosaJov', generic: 'Losartan', strength: '50mg', category: 'Cardiac', mrp: 98 },
      { name: 'Jovance Clopidogrel', brand: 'ClopiJov', generic: 'Clopidogrel', strength: '75mg', category: 'Cardiac', mrp: 155 },
      { name: 'Jovance Gabapentin', brand: 'GabaJov', generic: 'Gabapentin', strength: '300mg', category: 'Neuro', mrp: 180 },
      { name: 'Jovance Pregabalin', brand: 'PregaJov', generic: 'Pregabalin', strength: '75mg', category: 'Neuro', mrp: 210 },
    ];

    const medicines = [];
    for (let i = 0; i < medicineDefs.length; i++) {
      const m = medicineDefs[i]!;
      const opening = 400 + i * 20;
      const medicine = await prisma.medicine.create({
        data: {
          name: m.name,
          brandName: m.brand,
          genericName: m.generic,
          company: 'JOVANCE LABORATORIES PVT. LTD.',
          composition: m.generic,
          strength: m.strength,
          category: m.category,
          packSize: '10x10',
          mrp: m.mrp,
          sku: `JOV-${1000 + i}`,
          batchNumber: `B2026${String(i + 1).padStart(3, '0')}`,
          expiryDate: dateOnly(365 + i * 10),
          sampleAvailable: true,
          status: 'ACTIVE',
          createdBy: admin.id,
          updatedBy: admin.id,
          stock: {
            create: {
              openingStock: opening,
              issued: 0,
              returned: 0,
              available: opening,
              minimumStockAlert: 40,
              createdBy: admin.id,
              updatedBy: admin.id,
            },
          },
        },
        include: { stock: true },
      });
      medicines.push(medicine);
    }

    // Issue samples to each MR (company stock ↓, MR stock ↑)
    for (const mr of mrs) {
      for (let i = 0; i < 10; i++) {
        const medicine = medicines[i]!;
        const qty = 20 + (i % 5) * 5;
        await prisma.medicineIssue.create({
          data: {
            mrId: mr.id,
            medicineId: medicine.id,
            quantity: qty,
            batchNumber: medicine.batchNumber,
            issueDate: dateOnly(-20 + i),
            remarks: 'Field sample allocation',
            createdBy: admin.id,
            updatedBy: admin.id,
          },
        });
        await prisma.stock.update({
          where: { medicineId: medicine.id },
          data: {
            issued: { increment: qty },
            available: { decrement: qty },
            updatedBy: admin.id,
          },
        });
        await prisma.mrStock.upsert({
          where: { mrId_medicineId: { mrId: mr.id, medicineId: medicine.id } },
          create: {
            mrId: mr.id,
            medicineId: medicine.id,
            quantity: qty,
            batchNumber: medicine.batchNumber,
            createdBy: admin.id,
            updatedBy: admin.id,
          },
          update: {
            quantity: { increment: qty },
            updatedBy: admin.id,
          },
        });
        await prisma.stockMovement.create({
          data: {
            medicineId: medicine.id,
            mrId: mr.id,
            type: 'ISSUE',
            quantity: qty,
            remarks: 'Seed issue to MR',
            createdBy: admin.id,
            updatedBy: admin.id,
          },
        });
      }
    }

    // 50 appointments: 40 completed, 10 pending, 5 cancelled (+ extras mix)
    const appointments = [];
    for (let i = 0; i < 55; i++) {
      const doctor = doctors[i % doctors.length]!;
      const assignment = await prisma.doctorAssignment.findFirst({
        where: { doctorId: doctor.id, isActive: true },
      });
      const mrId = assignment?.mrId ?? mrs[0]!.id;
      let status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' = 'COMPLETED';
      if (i < 5) status = 'CANCELLED';
      else if (i < 15) status = 'PENDING';
      else if (i === 16) status = 'RESCHEDULED';
      else status = 'COMPLETED';

      const dayOffset = status === 'PENDING' ? (i % 7) : -((i % 40) + 1);
      const appt = await prisma.appointment.create({
        data: {
          doctorId: doctor.id,
          mrId,
          date: dateOnly(dayOffset),
          time: timeAt(9 + (i % 7), (i % 2) * 30),
          purpose: i % 2 === 0 ? 'Product detailing' : 'Sample & follow-up',
          status,
          remarks: 'Seeded appointment',
          createdBy: mrId,
          updatedBy: mrId,
        },
      });
      appointments.push(appt);
    }

    const completed = appointments.filter((a) => a.status === 'COMPLETED').slice(0, 40);
    let productCount = 0;
    let sampleCount = 0;
    let followUpCount = 0;

    for (let i = 0; i < completed.length; i++) {
      const appt = completed[i]!;
      const checkIn = timeAt(10 + (i % 5), 0);
      const checkOut = timeAt(10 + (i % 5), 30 + (i % 3) * 10);
      const hasFollowUp = i < 60 && i % 2 === 0;
      if (hasFollowUp) followUpCount += 1;

      const visit = await prisma.visit.create({
        data: {
          appointmentId: appt.id,
          doctorId: appt.doctorId,
          mrId: appt.mrId,
          visitDate: appt.date,
          visitTime: checkIn,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          meetingDurationMin: 30 + (i % 3) * 10,
          discussionNotes: 'Discussed efficacy, dosage and patient compliance.',
          doctorFeedback: i % 3 === 0 ? 'Interested in samples for OPD' : 'Will trial for 2 weeks',
          visitOutcome: i % 4 === 0 ? 'Positive' : 'Follow-up needed',
          nextFollowUp: hasFollowUp ? dateOnly((i % 10) + 1) : null,
          remarks: 'Seeded visit',
          createdBy: appt.mrId,
          updatedBy: appt.mrId,
        },
      });

      // 2–3 products discussed
      const productMeds = [medicines[i % medicines.length]!, medicines[(i + 3) % medicines.length]!];
      for (const med of productMeds) {
        await prisma.visitProduct.create({
          data: {
            visitId: visit.id,
            medicineId: med.id,
            notes: 'Interest: MEDIUM · Prescription expected',
            createdBy: appt.mrId,
            updatedBy: appt.mrId,
          },
        });
        productCount += 1;
      }

      // Sample distribution (reduce MR stock if available)
      for (let s = 0; s < 2; s++) {
        const med = medicines[(i + s) % 10]!;
        const qty = 2 + (s % 2);
        const mrStock = await prisma.mrStock.findUnique({
          where: { mrId_medicineId: { mrId: appt.mrId, medicineId: med.id } },
        });
        if (!mrStock || mrStock.quantity < qty) continue;

        await prisma.medicineDistribution.create({
          data: {
            visitId: visit.id,
            doctorId: appt.doctorId,
            mrId: appt.mrId,
            medicineId: med.id,
            quantity: qty,
            batchNumber: med.batchNumber,
            unit: 'Strips',
            remarks: 'OPD sample',
            distributedAt: appt.date,
            createdBy: appt.mrId,
            updatedBy: appt.mrId,
          },
        });
        await prisma.mrStock.update({
          where: { mrId_medicineId: { mrId: appt.mrId, medicineId: med.id } },
          data: { quantity: { decrement: qty }, updatedBy: appt.mrId },
        });
        await prisma.stockMovement.create({
          data: {
            medicineId: med.id,
            mrId: appt.mrId,
            type: 'SAMPLE',
            quantity: qty,
            remarks: `Sample on visit ${visit.id}`,
            createdBy: appt.mrId,
            updatedBy: appt.mrId,
          },
        });
        sampleCount += 1;
      }
    }

    // Attendance: ~30 days per MR
    for (const mr of mrs) {
      for (let d = 1; d <= 30; d++) {
        const workDate = dateOnly(-d);
        const checkInAt = new Date(workDate);
        checkInAt.setUTCHours(9, 10 + (d % 20), 0, 0);
        const checkOutAt = new Date(workDate);
        checkOutAt.setUTCHours(18, 5 + (d % 15), 0, 0);
        const workingMins = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
        await prisma.attendance.create({
          data: {
            mrId: mr.id,
            workDate,
            checkInAt,
            checkOutAt,
            workingMins,
            locationNote: 'Field territory',
            createdBy: mr.id,
            updatedBy: mr.id,
          },
        });
      }
    }

    // 40 sales entries
    for (let i = 0; i < 40; i++) {
      const mr = mrs[i % mrs.length]!;
      const medicine = medicines[i % medicines.length]!;
      const doctor = doctors[i % doctors.length]!;
      const store = stores[i % stores.length]!;
      const qty = 5 + (i % 10);
      await prisma.sale.create({
        data: {
          mrId: mr.id,
          medicineId: medicine.id,
          doctorId: i % 2 === 0 ? doctor.id : null,
          medicalStoreId: i % 2 === 1 ? store.id : store.id,
          quantity: qty,
          amount: Number(medicine.mrp) * qty * 0.85,
          invoiceDate: dateOnly(-(i % 28)),
          invoiceNumber: `INV-2026-${1000 + i}`,
          remarks: 'Retail / clinic sale',
          createdBy: mr.id,
          updatedBy: mr.id,
        },
      });
    }

    console.log('Seed complete:');
    console.log(`  Admin: ${admin.email} / Admin@12345`);
    console.log(`  MRs: ${mrs.length} (password Mr@12345) e.g. ${mrs[0]!.email}`);
    console.log(`  Doctors: ${doctors.length}`);
    console.log(`  Stores: ${stores.length}`);
    console.log(`  Medicines: ${medicines.length}`);
    console.log(`  Appointments: ${appointments.length}`);
    console.log(`  Completed visits: ${completed.length}`);
    console.log(`  Products discussed: ${productCount}`);
    console.log(`  Sample distributions: ${sampleCount}`);
    console.log(`  Follow-ups: ${followUpCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
