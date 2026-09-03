import type { LeaveStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

const requestInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      managerId: true,
      mrProfile: { select: { employeeCode: true, designation: true } },
    },
  },
  leaveType: { select: { id: true, code: true, name: true, colorHex: true, isPaid: true } },
  approvedBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.LeaveRequestInclude;

export type LeaveRequestRow = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;

/**
 * LeaveRepository — leave types, requests and per-year balances.
 * Design Pattern: Repository + Singleton
 */
export class LeaveRepository {
  private static instance: LeaveRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): LeaveRepository {
    if (!LeaveRepository.instance) LeaveRepository.instance = new LeaveRepository();
    return LeaveRepository.instance;
  }

  public getPrisma() {
    return this.prisma;
  }

  // ── Leave types ────────────────────────────────────────────────────────────

  public listTypes(includeInactive = false) {
    return this.prisma.leaveType.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { status: 'ACTIVE' }) },
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
    });
  }

  public findTypeById(id: number) {
    return this.prisma.leaveType.findFirst({ where: { id, deletedAt: null } });
  }

  public findTypeByCode(code: string) {
    return this.prisma.leaveType.findFirst({ where: { code, deletedAt: null } });
  }

  public createType(data: Prisma.LeaveTypeCreateInput) {
    return this.prisma.leaveType.create({ data });
  }

  public updateType(id: number, data: Prisma.LeaveTypeUpdateInput) {
    return this.prisma.leaveType.update({ where: { id }, data });
  }

  public softDeleteType(id: number, actorId: number) {
    return this.prisma.leaveType.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actorId },
    });
  }

  public countRequestsForType(leaveTypeId: number) {
    return this.prisma.leaveRequest.count({ where: { leaveTypeId, deletedAt: null } });
  }

  // ── Requests ───────────────────────────────────────────────────────────────

  public findRequestById(id: number) {
    return this.prisma.leaveRequest.findFirst({
      where: { id, deletedAt: null },
      include: requestInclude,
    });
  }

  public createRequest(data: Prisma.LeaveRequestCreateInput) {
    return this.prisma.leaveRequest.create({ data, include: requestInclude });
  }

  public updateRequest(id: number, data: Prisma.LeaveRequestUpdateInput) {
    return this.prisma.leaveRequest.update({ where: { id }, data, include: requestInclude });
  }

  public async listRequests(params: {
    page: number;
    limit: number;
    userId?: number;
    userIds?: number[];
    leaveTypeId?: number;
    status?: LeaveStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.LeaveRequestWhereInput = {
      deletedAt: null,
      ...(params.userId
        ? { userId: params.userId }
        : params.userIds
          ? { userId: { in: params.userIds } }
          : {}),
      ...(params.leaveTypeId ? { leaveTypeId: params.leaveTypeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      // Overlap test: request range intersects the requested window.
      ...(params.from ? { toDate: { gte: params.from } } : {}),
      ...(params.to ? { fromDate: { lte: params.to } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: [{ fromDate: 'desc' }, { id: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: requestInclude,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { items, total };
  }

  /** Live (pending or approved) requests that overlap a date window — used to block double booking. */
  public findOverlapping(params: {
    userId: number;
    fromDate: Date;
    toDate: Date;
    excludeId?: number;
  }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        deletedAt: null,
        userId: params.userId,
        status: { in: ['PENDING', 'APPROVED'] },
        fromDate: { lte: params.toDate },
        toDate: { gte: params.fromDate },
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      include: { leaveType: { select: { code: true, name: true } } },
    });
  }

  public countPending(userIds?: number[]) {
    return this.prisma.leaveRequest.count({
      where: {
        deletedAt: null,
        status: 'PENDING',
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
    });
  }

  // ── Balances ───────────────────────────────────────────────────────────────

  public listBalances(userId: number, year: number) {
    return this.prisma.leaveBalance.findMany({
      where: { userId, year },
      include: { leaveType: true },
      orderBy: { leaveTypeId: 'asc' },
    });
  }

  public upsertBalance(params: {
    userId: number;
    leaveTypeId: number;
    year: number;
    opening?: number;
    allocated?: number;
    used?: number;
    actorId?: number;
  }) {
    return this.prisma.leaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: {
          userId: params.userId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
      create: {
        userId: params.userId,
        leaveTypeId: params.leaveTypeId,
        year: params.year,
        opening: params.opening ?? 0,
        allocated: params.allocated ?? 0,
        used: params.used ?? 0,
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        ...(params.opening !== undefined ? { opening: params.opening } : {}),
        ...(params.allocated !== undefined ? { allocated: params.allocated } : {}),
        ...(params.used !== undefined ? { used: params.used } : {}),
        updatedBy: params.actorId,
      },
      include: { leaveType: true },
    });
  }

  /**
   * Sum of APPROVED days for a user / type / calendar year.
   * `used` is always derived from this — never incremented by hand.
   */
  public async sumApprovedDays(userId: number, leaveTypeId: number, year: number) {
    const result = await this.prisma.leaveRequest.aggregate({
      where: {
        deletedAt: null,
        userId,
        leaveTypeId,
        status: 'APPROVED',
        fromDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        toDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      },
      _sum: { days: true },
    });
    return Number(result._sum.days ?? 0);
  }

  /** Distinct leave-type ids the user has ever used in a year (to refresh their balances). */
  public async usedTypeIds(userId: number, year: number): Promise<number[]> {
    const rows = await this.prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where: {
        deletedAt: null,
        userId,
        fromDate: { gte: new Date(Date.UTC(year, 0, 1)) },
        toDate: { lte: new Date(Date.UTC(year, 11, 31)) },
      },
    });
    return rows.map((row) => row.leaveTypeId);
  }
}
