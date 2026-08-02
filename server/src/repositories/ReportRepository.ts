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

  public async appointmentStats(
    from: Date,
    to: Date,
    filters?: { mrId?: number; doctorId?: number; status?: string },
  ) {
    const where = {
      deletedAt: null as null,
      date: { gte: from, lte: to },
      ...(filters?.mrId ? { mrId: filters.mrId } : {}),
      ...(filters?.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters?.status ? { status: filters.status as never } : {}),
    };

    const [total, pending, completed, cancelled, rescheduled] = await Promise.all([
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
      this.prisma.appointment.count({
        where: { ...where, status: AppointmentStatuses.RESCHEDULED },
      }),
    ]);

    return { total, pending, completed, cancelled, rescheduled };
  }

  public async visitStats(
    from: Date,
    to: Date,
    filters?: { mrId?: number; doctorId?: number },
  ) {
    const where = {
      deletedAt: null as null,
      visitDate: { gte: from, lte: to },
      ...(filters?.mrId ? { mrId: filters.mrId } : {}),
      ...(filters?.doctorId ? { doctorId: filters.doctorId } : {}),
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

  public async distributionStats(
    from: Date,
    to: Date,
    filters?: { mrId?: number; doctorId?: number; medicineId?: number },
  ) {
    const where = {
      deletedAt: null as null,
      distributedAt: { gte: from, lte: to },
      ...(filters?.mrId ? { mrId: filters.mrId } : {}),
      ...(filters?.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters?.medicineId ? { medicineId: filters.medicineId } : {}),
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

  public async mrPerformance(from: Date, to: Date, mrId?: number) {
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

  public async doctorVisitReport(from: Date, to: Date, mrId?: number) {
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

  public async mrDetail(from: Date, to: Date, mrId: number) {
    const yearStart = new Date(Date.UTC(from.getUTCFullYear(), 0, 1));
    const [
      attendanceDays,
      dailyVisitGroups,
      monthlyVisits,
      doctorCount,
      appointments,
      completedVisits,
      pendingAppointments,
      cancelledAppointments,
      distributionCount,
      samplesAgg,
      salesMonth,
      salesYear,
      performance,
    ] = await Promise.all([
      this.prisma.attendance.count({
        where: { deletedAt: null, mrId, workDate: { gte: from, lte: to }, checkInAt: { not: null } },
      }),
      this.prisma.visit.groupBy({
        by: ['visitDate'],
        where: { deletedAt: null, mrId, visitDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { visitDate: 'asc' },
      }),
      this.prisma.visit.count({
        where: { deletedAt: null, mrId, visitDate: { gte: from, lte: to } },
      }),
      this.prisma.doctorAssignment.count({
        where: { deletedAt: null, mrId, isActive: true },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, mrId, date: { gte: from, lte: to } },
      }),
      this.prisma.visit.count({
        where: { deletedAt: null, mrId, visitDate: { gte: from, lte: to } },
      }),
      this.prisma.appointment.count({
        where: {
          deletedAt: null,
          mrId,
          date: { gte: from, lte: to },
          status: AppointmentStatuses.PENDING,
        },
      }),
      this.prisma.appointment.count({
        where: {
          deletedAt: null,
          mrId,
          date: { gte: from, lte: to },
          status: AppointmentStatuses.CANCELLED,
        },
      }),
      this.prisma.medicineDistribution.count({
        where: { deletedAt: null, mrId, distributedAt: { gte: from, lte: to } },
      }),
      this.prisma.medicineDistribution.aggregate({
        where: { deletedAt: null, mrId, distributedAt: { gte: from, lte: to } },
        _sum: { quantity: true },
      }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, mrId, invoiceDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, mrId, invoiceDate: { gte: yearStart, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.visit.groupBy({
        by: ['visitDate'],
        where: { deletedAt: null, mrId, visitDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { visitDate: 'asc' },
      }),
    ]);

    const avgDailyVisits =
      dailyVisitGroups.length === 0
        ? 0
        : Number(
            (
              dailyVisitGroups.reduce((sum, row) => sum + row._count._all, 0) /
              dailyVisitGroups.length
            ).toFixed(2),
          );

    return {
      summary: {
        attendanceDays,
        dailyVisitCount: avgDailyVisits,
        monthlyVisitCount: monthlyVisits,
        doctorCount,
        appointmentCount: appointments,
        completedVisits,
        pendingVisits: pendingAppointments,
        cancelledVisits: cancelledAppointments,
        medicineDistributionCount: distributionCount,
        totalSamplesGiven: samplesAgg._sum.quantity ?? 0,
        monthlySales: Number(salesMonth._sum.amount ?? 0),
        yearlySales: Number(salesYear._sum.amount ?? 0),
        sales: Number(salesMonth._sum.amount ?? 0),
      },
      rows: performance.map((row) => ({
        date: row.visitDate.toISOString().slice(0, 10),
        visits: row._count._all,
      })),
    };
  }

  public async salesReport(
    from: Date,
    to: Date,
    filters?: { mrId?: number; doctorId?: number; medicineId?: number; medicalStoreId?: number },
  ) {
    const where = {
      deletedAt: null as null,
      invoiceDate: { gte: from, lte: to },
      ...(filters?.mrId ? { mrId: filters.mrId } : {}),
      ...(filters?.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters?.medicineId ? { medicineId: filters.medicineId } : {}),
      ...(filters?.medicalStoreId ? { medicalStoreId: filters.medicalStoreId } : {}),
    };

    const [rows, aggregate] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        take: 200,
        include: {
          medicine: { select: { id: true, name: true } },
          mr: { select: { id: true, fullName: true } },
          doctor: { select: { id: true, fullName: true } },
          medicalStore: { select: { id: true, name: true } },
        },
      }),
      this.prisma.sale.aggregate({ where, _sum: { amount: true, quantity: true } }),
    ]);

    return {
      summary: {
        totalAmount: Number(aggregate._sum.amount ?? 0),
        totalQuantity: aggregate._sum.quantity ?? 0,
        rows: rows.length,
      },
      rows: rows.map((row) => ({
        invoiceDate: row.invoiceDate.toISOString().slice(0, 10),
        medicine: row.medicine.name,
        mr: row.mr.fullName,
        doctor: row.doctor?.fullName ?? '—',
        store: row.medicalStore?.name ?? '—',
        quantity: row.quantity,
        amount: Number(row.amount),
      })),
    };
  }
}
