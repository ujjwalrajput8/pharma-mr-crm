import { AppointmentStatuses } from '../constants';
import { PrismaService } from '../prisma/PrismaService';

export class ReportRepository {
  private static instance: ReportRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): ReportRepository {
    if (!ReportRepository.instance) {
      ReportRepository.instance = new ReportRepository();
    }
    return ReportRepository.instance;
  }

  public async appointmentStats(from: Date, to: Date, mrId?: string) {
    const where = {
      deletedAt: null as null,
      date: { gte: from, lte: to },
      ...(mrId ? { mrId } : {}),
    };

    const [total, pending, completed, cancelled] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.count({
        where: { ...where, status: AppointmentStatuses.PENDING },
      }),
      this.prisma.appointment.count({
        where: { ...where, status: AppointmentStatuses.COMPLETED },
      }),
      this.prisma.appointment.count({
        where: { ...where, status: AppointmentStatuses.CANCELLED },
      }),
    ]);

    return { total, pending, completed, cancelled };
  }

  public async visitStats(from: Date, to: Date, mrId?: string) {
    const where = {
      deletedAt: null as null,
      visitDate: { gte: from, lte: to },
      ...(mrId ? { mrId } : {}),
    };

    const [total, withFollowUp] = await Promise.all([
      this.prisma.visit.count({ where }),
      this.prisma.visit.count({
        where: { ...where, nextFollowUp: { not: null } },
      }),
    ]);

    const visits = await this.prisma.visit.findMany({
      where,
      orderBy: { visitDate: 'desc' },
      take: 50,
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true } },
      },
    });

    return { total, withFollowUp, recent: visits };
  }

  public async distributionStats(from: Date, to: Date, mrId?: string) {
    const where = {
      deletedAt: null as null,
      distributedAt: { gte: from, lte: to },
      ...(mrId ? { mrId } : {}),
    };

    const [totalRows, aggregate] = await Promise.all([
      this.prisma.medicineDistribution.count({ where }),
      this.prisma.medicineDistribution.aggregate({
        where,
        _sum: { quantity: true },
      }),
    ]);

    const byMedicine = await this.prisma.medicineDistribution.groupBy({
      by: ['medicineId'],
      where,
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    });

    const medicineIds = byMedicine.map((row) => row.medicineId);
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
      select: { id: true, name: true },
    });
    const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));

    return {
      totalRows,
      totalQuantity: aggregate._sum.quantity ?? 0,
      byMedicine: byMedicine.map((row) => ({
        medicineId: row.medicineId,
        medicineName: medicineMap.get(row.medicineId) ?? 'Unknown',
        quantity: row._sum.quantity ?? 0,
        rows: row._count._all,
      })),
    };
  }

  public async stockReport() {
    const stocks = await this.prisma.stock.findMany({
      where: { deletedAt: null },
      include: { medicine: { select: { id: true, name: true, company: true } } },
      orderBy: { available: 'asc' },
    });

    return stocks.map((stock) => ({
      medicineId: stock.medicineId,
      medicineName: stock.medicine.name,
      company: stock.medicine.company,
      openingStock: stock.openingStock,
      issued: stock.issued,
      returned: stock.returned,
      available: stock.available,
      minimumStockAlert: stock.minimumStockAlert,
      isLow: stock.available <= stock.minimumStockAlert,
    }));
  }

  public async mrPerformance(from: Date, to: Date, mrId?: string) {
    const mrs = await this.prisma.user.findMany({
      where: {
        role: 'MR',
        deletedAt: null,
        ...(mrId ? { id: mrId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        mrProfile: { select: { employeeCode: true, assignedArea: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const results = await Promise.all(
      mrs.map(async (mr) => {
        const [appointments, visits, samples] = await Promise.all([
          this.prisma.appointment.count({
            where: {
              deletedAt: null,
              mrId: mr.id,
              date: { gte: from, lte: to },
            },
          }),
          this.prisma.visit.count({
            where: {
              deletedAt: null,
              mrId: mr.id,
              visitDate: { gte: from, lte: to },
            },
          }),
          this.prisma.medicineDistribution.aggregate({
            where: {
              deletedAt: null,
              mrId: mr.id,
              distributedAt: { gte: from, lte: to },
            },
            _sum: { quantity: true },
          }),
        ]);

        return {
          mrId: mr.id,
          fullName: mr.fullName,
          email: mr.email,
          employeeCode: mr.mrProfile?.employeeCode ?? null,
          assignedArea: mr.mrProfile?.assignedArea ?? null,
          appointments,
          visits,
          samplesDistributed: samples._sum.quantity ?? 0,
        };
      }),
    );

    return results;
  }

  public async doctorVisitReport(from: Date, to: Date, mrId?: string) {
    const visits = await this.prisma.visit.groupBy({
      by: ['doctorId'],
      where: {
        deletedAt: null,
        visitDate: { gte: from, lte: to },
        ...(mrId ? { mrId } : {}),
      },
      _count: { doctorId: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 50,
    });

    const doctors = await this.prisma.doctor.findMany({
      where: { id: { in: visits.map((v) => v.doctorId) } },
      select: { id: true, fullName: true, specialization: true, city: true },
    });
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    return visits.map((row) => {
      const doctor = doctorMap.get(row.doctorId);
      return {
        doctorId: row.doctorId,
        doctorName: doctor?.fullName ?? 'Unknown',
        specialization: doctor?.specialization ?? null,
        city: doctor?.city ?? null,
        visitCount: row._count.doctorId,
      };
    });
  }
}
