import { AppRoles, AppointmentStatuses, HolderTypes, StockTxnTypes } from '../constants';
import { PrismaService } from '../prisma/PrismaService';
import { SettingRepository } from '../repositories/SettingRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';

const DEFAULT_WAREHOUSE_SETTING = 'stock.default_warehouse_id';

export class DashboardService {
  private static instance: DashboardService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly settings = SettingRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
  ) {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  private async getDefaultWarehouseId(): Promise<number | null> {
    const setting = await this.settings.findByKey(DEFAULT_WAREHOUSE_SETTING);
    if (!setting) return null;
    const warehouseId = Number(setting.value);
    return Number.isInteger(warehouseId) && warehouseId > 0 ? warehouseId : null;
  }

  /** Empty = all (Admin). Single or in-list for MR / Manager. */
  private async resolveMrScope(actor: AuthUser): Promise<{ mrId?: number } | { mrId: { in: number[] } } | Record<string, never>> {
    if (actor.role === AppRoles.MR) return { mrId: actor.id };
    if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      return { mrId: { in: [actor.id, ...teamIds] } };
    }
    return {};
  }

  private async resolveSampleHolderScope(actor: AuthUser) {
    if (actor.role === AppRoles.MR) {
      return { fromHolderType: HolderTypes.USER, fromHolderId: actor.id };
    }
    if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      return {
        fromHolderType: HolderTypes.USER,
        fromHolderId: { in: [actor.id, ...teamIds] },
      };
    }
    return {};
  }

  public async getSummary(actor: AuthUser) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const todayDate = new Date(`${todayStart.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const monthStart = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(todayDate.getUTCFullYear(), 0, 1));
    const mrScope = await this.resolveMrScope(actor);
    const warehouseId = await this.getDefaultWarehouseId();
    const sampleHolderScope = await this.resolveSampleHolderScope(actor);

    const sampleWhere = {
      txnType: StockTxnTypes.SAMPLE_GIVEN,
      ...sampleHolderScope,
      txnDate: { gte: monthStart, lte: todayEnd },
    };

    const [
      totalMrs,
      totalDoctors,
      totalStores,
      totalMedicines,
      todaysAppointments,
      todaysVisits,
      pendingAppointments,
      completedAppointments,
      cancelledAppointments,
      rescheduledAppointments,
      pendingFollowUps,
      monthlyVisits,
      completedVisits,
      assignedDoctors,
      warehouseStockAgg,
      distributionAgg,
      todaysSalesAgg,
      monthlySalesAgg,
      yearlySalesAgg,
      todayAttendance,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: AppRoles.MR, deletedAt: null } }),
      this.prisma.doctor.count({ where: { deletedAt: null } }),
      this.prisma.medicalStore.count({ where: { deletedAt: null } }),
      this.prisma.medicine.count({ where: { deletedAt: null } }),
      this.prisma.appointment.count({
        where: { deletedAt: null, date: todayDate, ...mrScope },
      }),
      this.prisma.visit.count({
        where: { deletedAt: null, visitDate: todayDate, ...mrScope },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, status: AppointmentStatuses.PENDING, ...mrScope },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, status: AppointmentStatuses.COMPLETED, ...mrScope },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, status: AppointmentStatuses.CANCELLED, ...mrScope },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, status: AppointmentStatuses.RESCHEDULED, ...mrScope },
      }),
      this.prisma.visit.count({
        where: {
          deletedAt: null,
          nextFollowUp: { lte: todayEnd, gte: todayStart },
          ...mrScope,
        },
      }),
      this.prisma.visit.count({
        where: { deletedAt: null, visitDate: { gte: monthStart, lte: todayEnd }, ...mrScope },
      }),
      this.prisma.visit.count({
        where: { deletedAt: null, ...mrScope },
      }),
      actor.role === AppRoles.MR
        ? this.prisma.doctorAssignment.count({
            where: { deletedAt: null, mrId: actor.id, isActive: true },
          })
        : Promise.resolve(0),
      warehouseId
        ? this.prisma.stockBalance.aggregate({
            where: {
              holderType: HolderTypes.WAREHOUSE,
              holderId: warehouseId,
            },
            _sum: { qty: true },
          })
        : Promise.resolve({ _sum: { qty: 0 } }),
      this.prisma.stockTxn.aggregate({
        where: sampleWhere,
        _sum: { qty: true },
      }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, invoiceDate: todayDate, ...mrScope },
        _sum: { amount: true },
      }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, invoiceDate: { gte: monthStart, lte: todayEnd }, ...mrScope },
        _sum: { amount: true },
      }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, invoiceDate: { gte: yearStart, lte: todayEnd }, ...mrScope },
        _sum: { amount: true },
      }),
      actor.role === AppRoles.MR
        ? this.prisma.attendance.findFirst({
            where: { userId: actor.id, attDate: todayDate, deletedAt: null },
          })
        : Promise.resolve(null),
    ]);

    const lowStockCount =
      warehouseId == null
        ? 0
        : await this.prisma.stockBalance
            .groupBy({
              by: ['medicineId'],
              where: { holderType: HolderTypes.WAREHOUSE, holderId: warehouseId },
              _sum: { qty: true },
            })
            .then((rows) => rows.filter((row) => (row._sum.qty ?? 0) <= 10).length);

    const availableSampleStock = warehouseStockAgg._sum.qty ?? 0;
    const medicineDistributionQty = distributionAgg._sum.qty ?? 0;
    const todaysSales = Number(todaysSalesAgg._sum.amount ?? 0);
    const monthlySales = Number(monthlySalesAgg._sum.amount ?? 0);
    const yearlySales = Number(yearlySalesAgg._sum.amount ?? 0);

    const insights =
      actor.role === AppRoles.ADMIN
        ? await this.buildAdminInsights(monthStart, todayEnd)
        : actor.role === AppRoles.MANAGER
          ? await this.buildAdminInsights(monthStart, todayEnd)
          : await this.buildMrInsights(actor.id, monthStart, todayEnd);

    if (actor.role === AppRoles.ADMIN || actor.role === AppRoles.MANAGER) {
      return {
        role: actor.role,
        cards: {
          totalDoctors,
          totalMrs:
            actor.role === AppRoles.MANAGER
              ? (await this.users.listReportIds(actor.id)).length
              : totalMrs,
          todaysAppointments,
          todaysVisits,
          pendingAppointments,
          completedAppointments,
          cancelledAppointments,
          rescheduledAppointments,
          completedVisits,
          medicineStock: availableSampleStock,
          medicineDistribution: medicineDistributionQty,
          monthlyVisits,
          availableSampleStock,
          totalStores,
          totalMedicines,
          pendingFollowUps,
          lowStockCount,
          todaysSales,
          monthlySales,
          yearlySales,
          companyTotalSales: yearlySales,
        },
        insights,
        meta: {
          yearStart: yearStart.toISOString().slice(0, 10),
          monthStart: monthStart.toISOString().slice(0, 10),
        },
      };
    }

    return {
      role: actor.role,
      cards: {
        todaysAppointments,
        todaysVisits,
        pendingFollowUps,
        assignedDoctors,
        pendingAppointments,
        completedAppointments,
        cancelledAppointments,
        rescheduledAppointments,
        monthlyVisits,
        samplesRemaining: availableSampleStock,
        completedVisits,
        attendanceToday: todayAttendance?.checkInAt ? 1 : 0,
        monthlyPerformance: monthlyVisits,
        todaysSales,
        monthlySales,
      },
      insights,
    };
  }

  private async buildAdminInsights(from: Date, to: Date) {
    const [visitGroups, sampleGroups, salesByMr, salesByMedicine] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['mrId'],
        where: { deletedAt: null, visitDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { _count: { mrId: 'desc' } },
        take: 5,
      }),
      this.prisma.stockTxn.groupBy({
        by: ['medicineId'],
        where: { txnType: StockTxnTypes.SAMPLE_GIVEN, txnDate: { gte: from, lte: to } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
      this.prisma.sale.groupBy({
        by: ['mrId'],
        where: { deletedAt: null, invoiceDate: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      this.prisma.sale.groupBy({
        by: ['medicineId'],
        where: { deletedAt: null, invoiceDate: { gte: from, lte: to } },
        _sum: { amount: true, quantity: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    const mrIds = [...new Set([...visitGroups.map((r) => r.mrId), ...salesByMr.map((r) => r.mrId)])];
    const medicineIds = [
      ...new Set([...sampleGroups.map((r) => r.medicineId), ...salesByMedicine.map((r) => r.medicineId)]),
    ];
    const [mrs, medicines] = await Promise.all([
      mrIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      medicineIds.length
        ? this.prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const mrMap = new Map(mrs.map((m) => [m.id, m.fullName]));
    const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));
    const salesMap = new Map(salesByMr.map((r) => [r.mrId, Number(r._sum.amount ?? 0)]));

    return {
      topPerformingMrs: visitGroups.map((row) => ({
        mrId: row.mrId,
        fullName: mrMap.get(row.mrId) ?? 'Unknown',
        visits: row._count._all,
        sales: salesMap.get(row.mrId) ?? 0,
      })),
      topPrescribedMedicines: sampleGroups.map((row) => ({
        medicineId: row.medicineId,
        name: medicineMap.get(row.medicineId) ?? 'Unknown',
        samples: row._sum.qty ?? 0,
      })),
      mrWiseSales: salesByMr.map((row) => ({
        mrId: row.mrId,
        fullName: mrMap.get(row.mrId) ?? 'Unknown',
        amount: Number(row._sum.amount ?? 0),
      })),
      medicineWiseSales: salesByMedicine.map((row) => ({
        medicineId: row.medicineId,
        name: medicineMap.get(row.medicineId) ?? 'Unknown',
        amount: Number(row._sum.amount ?? 0),
        quantity: row._sum.quantity ?? 0,
      })),
    };
  }

  private async buildMrInsights(mrId: number, from: Date, to: Date) {
    const [dailyVisits, sampleTop, salesTop] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['visitDate'],
        where: { deletedAt: null, mrId, visitDate: { gte: from, lte: to } },
        _count: { _all: true },
        orderBy: { visitDate: 'asc' },
      }),
      this.prisma.stockTxn.groupBy({
        by: ['medicineId'],
        where: {
          txnType: StockTxnTypes.SAMPLE_GIVEN,
          fromHolderType: HolderTypes.USER,
          fromHolderId: mrId,
          txnDate: { gte: from, lte: to },
        },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
      this.prisma.sale.groupBy({
        by: ['medicineId'],
        where: { deletedAt: null, mrId, invoiceDate: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    const medicineIds = [
      ...new Set([...sampleTop.map((r) => r.medicineId), ...salesTop.map((r) => r.medicineId)]),
    ];
    const medicines = medicineIds.length
      ? await this.prisma.medicine.findMany({
          where: { id: { in: medicineIds } },
          select: { id: true, name: true },
        })
      : [];
    const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));

    return {
      performanceGraph: dailyVisits.map((row) => ({
        date: row.visitDate.toISOString().slice(0, 10),
        visits: row._count._all,
      })),
      topPrescribedMedicines: sampleTop.map((row) => ({
        medicineId: row.medicineId,
        name: medicineMap.get(row.medicineId) ?? 'Unknown',
        samples: row._sum.qty ?? 0,
      })),
      medicineWiseSales: salesTop.map((row) => ({
        medicineId: row.medicineId,
        name: medicineMap.get(row.medicineId) ?? 'Unknown',
        amount: Number(row._sum.amount ?? 0),
      })),
    };
  }
}
