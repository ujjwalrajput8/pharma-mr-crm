import type { Prisma } from '@prisma/client';
import { HolderTypes, StockTxnTypes } from '../constants';
import { PrismaService } from '../prisma/PrismaService';

const directoryInclude = {
  mrProfile: true,
  manager: { select: { id: true, fullName: true, email: true, role: true } },
  territory: { select: { id: true, name: true, type: true } },
} satisfies Prisma.UserInclude;

export type EmployeeRow = Prisma.UserGetPayload<{ include: typeof directoryInclude }>;

/**
 * EmployeeRepository — user rows joined with their HR profile, plus the
 * per-employee activity counters the profile screen shows.
 */
export class EmployeeRepository {
  private static instance: EmployeeRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): EmployeeRepository {
    if (!EmployeeRepository.instance) EmployeeRepository.instance = new EmployeeRepository();
    return EmployeeRepository.instance;
  }

  public findFullById(id: number): Promise<EmployeeRow | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: directoryInclude,
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
    managerId?: number;
    /** Team scope — `undefined` means company-wide (Admin). */
    userIds?: number[];
  }): Promise<{ items: EmployeeRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: params.role
        ? (params.role as Prisma.EnumRoleFilter['equals'])
        : { in: ['MR', 'MANAGER'] },
      ...(params.status ? { status: params.status as Prisma.EnumUserStatusFilter['equals'] } : {}),
      ...(params.managerId ? { managerId: params.managerId } : {}),
      ...(params.userIds ? { id: { in: params.userIds } } : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
              { mrProfile: { employeeCode: { contains: params.search, mode: 'insensitive' } } },
              { mrProfile: { designation: { contains: params.search, mode: 'insensitive' } } },
              { mrProfile: { assignedArea: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: directoryInclude,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  public updateProfile(profileId: number, data: Record<string, unknown>) {
    return this.prisma.mrProfile.update({
      where: { id: profileId },
      data: data as Prisma.MrProfileUpdateInput,
    });
  }

  /** Field activity for the selected month — visits, calls, samples, POB value. */
  public async activityCounts(userId: number, range: { start: Date; end: Date }) {
    const [visits, appointments, assignedDoctors, samples, sales] = await Promise.all([
      this.prisma.visit.count({
        where: {
          deletedAt: null,
          mrId: userId,
          visitDate: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.appointment.count({
        where: { deletedAt: null, mrId: userId, date: { gte: range.start, lte: range.end } },
      }),
      this.prisma.doctorAssignment.count({
        where: { deletedAt: null, mrId: userId, isActive: true },
      }),
      this.prisma.stockTxn.aggregate({
        where: {
          txnType: StockTxnTypes.SAMPLE_GIVEN,
          fromHolderType: HolderTypes.USER,
          fromHolderId: userId,
          txnDate: { gte: range.start, lte: range.end },
        },
        _sum: { qty: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          deletedAt: null,
          mrId: userId,
          invoiceDate: { gte: range.start, lte: range.end },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      visits,
      appointments,
      assignedDoctors,
      samplesGiven: samples._sum.qty ?? 0,
      salesCount: sales._count._all,
      salesAmount: Number(sales._sum.amount ?? 0),
    };
  }
}
