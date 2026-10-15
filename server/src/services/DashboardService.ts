import {
  AppRoles,
  AppointmentStatuses,
  HolderTypes,
  LeaveStatuses,
  RecordStatuses,
  StockTxnTypes,
} from '../constants';
import { PrismaService } from '../prisma/PrismaService';
import { SettingRepository } from '../repositories/SettingRepository';
import { UserRepository } from '../repositories/UserRepository';
import { TeamScopeService } from './TeamScopeService';
import type { AuthUser } from '../types/auth.types';

const DEFAULT_WAREHOUSE_SETTING = 'stock.default_warehouse_id';

export class DashboardService {
  private static instance: DashboardService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly settings = SettingRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly teamScope = TeamScopeService.getInstance(),
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

  /**
   * Time-series + coverage data for the dashboard charts. One round of grouped
   * queries, zero-filled per day, scoped exactly like the summary:
   * MR → own records, Manager → self + reporting sub-tree, Admin → company-wide.
   */
  public async getTrends(actor: AuthUser, days: number) {
    const rangeEnd = new Date();
    rangeEnd.setUTCHours(23, 59, 59, 999);
    const todayDate = new Date(`${rangeEnd.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const rangeStart = new Date(todayDate);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    // undefined = company-wide (Admin); otherwise the visible user id list.
    const userIds = await this.teamScope.visibleUserIds(actor);
    const mrScope = userIds ? { mrId: { in: userIds } } : {};
    const dateRange = { gte: rangeStart, lte: rangeEnd };
    const sampleScope = userIds
      ? { fromHolderType: HolderTypes.USER, fromHolderId: { in: userIds } }
      : {};
    const includeLeave = actor.role !== AppRoles.MR;

    const [
      visitGroups,
      apptGroups,
      saleGroups,
      visitedDoctorGroups,
      totalDoctorsInScope,
      leaveGroups,
      sampleGroups,
    ] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['visitDate'],
        where: { deletedAt: null, visitDate: dateRange, ...mrScope },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['date'],
        where: { deletedAt: null, date: dateRange, ...mrScope },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({
        by: ['invoiceDate'],
        where: { deletedAt: null, invoiceDate: dateRange, ...mrScope },
        _sum: { amount: true },
      }),
      // Distinct doctors actually visited within the range (scope applied).
      this.prisma.visit.groupBy({
        by: ['doctorId'],
        where: { deletedAt: null, doctorId: { not: null }, visitDate: dateRange, ...mrScope },
      }),
      // Active doctors in scope: assignment-based for MR/Manager, all for Admin.
      userIds
        ? this.prisma.doctorAssignment
            .groupBy({
              by: ['doctorId'],
              where: {
                deletedAt: null,
                isActive: true,
                mrId: { in: userIds },
                doctor: { deletedAt: null, status: RecordStatuses.ACTIVE },
              },
            })
            .then((rows) => rows.length)
        : this.prisma.doctor.count({
            where: { deletedAt: null, status: RecordStatuses.ACTIVE },
          }),
      // Approved leaves touching the range, grouped by type (managers/admins only).
      includeLeave
        ? this.prisma.leaveRequest.groupBy({
            by: ['leaveTypeId'],
            where: {
              deletedAt: null,
              status: LeaveStatuses.APPROVED,
              fromDate: { lte: rangeEnd },
              toDate: { gte: rangeStart },
              ...(userIds ? { userId: { in: userIds } } : {}),
            },
            _sum: { days: true },
          })
        : Promise.resolve([]),
      this.prisma.stockTxn.groupBy({
        by: ['medicineId'],
        where: { txnType: StockTxnTypes.SAMPLE_GIVEN, txnDate: dateRange, ...sampleScope },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
    ]);

    const leaveTypeIds = leaveGroups.map((row) => row.leaveTypeId);
    const medicineIds = sampleGroups.map((row) => row.medicineId);
    const [leaveTypes, medicines] = await Promise.all([
      leaveTypeIds.length
        ? this.prisma.leaveType.findMany({
            where: { id: { in: leaveTypeIds } },
            select: { id: true, code: true, name: true, colorHex: true },
          })
        : Promise.resolve([]),
      medicineIds.length
        ? this.prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const leaveTypeMap = new Map(leaveTypes.map((t) => [t.id, t]));
    const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));

    const visitMap = new Map(
      visitGroups.map((row) => [row.visitDate.toISOString().slice(0, 10), row._count._all]),
    );
    const apptMap = new Map(
      apptGroups.map((row) => [row.date.toISOString().slice(0, 10), row._count._all]),
    );
    const salesMap = new Map(
      saleGroups.map((row) => [
        row.invoiceDate.toISOString().slice(0, 10),
        Number(row._sum.amount ?? 0),
      ]),
    );

    const visitsByDay: Array<{ date: string; visits: number; appointments: number }> = [];
    const salesByDay: Array<{ date: string; amount: number }> = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setUTCDate(rangeStart.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      visitsByDay.push({
        date: key,
        visits: visitMap.get(key) ?? 0,
        appointments: apptMap.get(key) ?? 0,
      });
      salesByDay.push({ date: key, amount: salesMap.get(key) ?? 0 });
    }

    const leaveDistribution = leaveGroups
      .map((row) => {
        const type = leaveTypeMap.get(row.leaveTypeId);
        return {
          code: type?.code ?? `#${row.leaveTypeId}`,
          name: type?.name ?? 'Unknown',
          colorHex: type?.colorHex ?? '#0f766e',
          days: Number(row._sum.days ?? 0),
        };
      })
      .sort((a, b) => b.days - a.days);

    return {
      from: rangeStart.toISOString().slice(0, 10),
      to: todayDate.toISOString().slice(0, 10),
      days,
      visitsByDay,
      salesByDay,
      doctorCoverage: {
        visited: visitedDoctorGroups.length,
        total: totalDoctorsInScope,
      },
      leaveDistribution,
      topMedicines: sampleGroups.map((row) => ({
        medicineId: row.medicineId,
        name: medicineMap.get(row.medicineId) ?? 'Unknown',
        qty: row._sum.qty ?? 0,
      })),
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
