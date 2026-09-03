import type { AttendanceStatus, Prisma, WorkType } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class AttendanceRepository {
  private static instance: AttendanceRepository | null = null;
  private constructor(private readonly prisma = PrismaService.getClient()) {}
  public static getInstance(): AttendanceRepository {
    if (!AttendanceRepository.instance) AttendanceRepository.instance = new AttendanceRepository();
    return AttendanceRepository.instance;
  }

  public findToday(userId: number, attDate: Date) {
    return this.prisma.attendance.findFirst({
      where: { userId, attDate, deletedAt: null },
    });
  }

  public findById(id: number) {
    return this.prisma.attendance.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
  }

  public upsertCheckIn(params: {
    userId: number;
    attDate: Date;
    checkInAt: Date;
    /** PRESENT or LATE — decided by the service against the configured shift start. */
    status: AttendanceStatus;
    workType: WorkType;
    inLat?: number;
    inLng?: number;
    accuracyM?: number;
    isMockLocation?: boolean;
    deviceAt?: Date;
    flagReason?: string | null;
    locationNote?: string;
    remarks?: string;
    actorId: number;
  }) {
    return this.prisma.attendance.upsert({
      where: { userId_attDate: { userId: params.userId, attDate: params.attDate } },
      create: {
        userId: params.userId,
        attDate: params.attDate,
        checkInAt: params.checkInAt,
        inLat: params.inLat,
        inLng: params.inLng,
        accuracyM: params.accuracyM,
        isMockLocation: params.isMockLocation ?? false,
        deviceAt: params.deviceAt,
        flagReason: params.flagReason ?? null,
        locationNote: params.locationNote,
        remarks: params.remarks,
        status: params.status,
        workType: params.workType,
        serverAt: new Date(),
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        checkInAt: params.checkInAt,
        checkOutAt: null,
        workingMins: null,
        inLat: params.inLat,
        inLng: params.inLng,
        accuracyM: params.accuracyM,
        isMockLocation: params.isMockLocation ?? false,
        deviceAt: params.deviceAt,
        flagReason: params.flagReason ?? null,
        locationNote: params.locationNote,
        remarks: params.remarks,
        status: params.status,
        workType: params.workType,
        leaveRequestId: null,
        deletedAt: null,
        serverAt: new Date(),
        updatedBy: params.actorId,
      },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
  }

  public upsertManaged(params: {
    userId: number;
    attDate: Date;
    status: AttendanceStatus;
    workType?: WorkType | null;
    remarks?: string;
    actorId: number;
  }) {
    const clearTimes = params.status === 'ABSENT' || params.status === 'LEAVE' || params.status === 'HOLIDAY';
    return this.prisma.attendance.upsert({
      where: { userId_attDate: { userId: params.userId, attDate: params.attDate } },
      create: {
        userId: params.userId,
        attDate: params.attDate,
        status: params.status,
        workType: params.workType ?? null,
        remarks: params.remarks,
        checkInAt: null,
        checkOutAt: null,
        workingMins: null,
        approvedById: params.actorId,
        serverAt: new Date(),
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        status: params.status,
        ...(params.workType !== undefined ? { workType: params.workType } : {}),
        remarks: params.remarks,
        ...(clearTimes ? { checkInAt: null, checkOutAt: null, workingMins: null } : {}),
        approvedById: params.actorId,
        deletedAt: null,
        updatedBy: params.actorId,
      },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
  }

  /**
   * Writes one approved-leave day into the attendance register.
   * Keeps `leaveRequestId` so cancelling the leave can release exactly these rows.
   */
  public upsertLeaveDay(params: {
    userId: number;
    attDate: Date;
    leaveRequestId: number;
    remarks?: string;
    actorId: number;
  }) {
    return this.prisma.attendance.upsert({
      where: { userId_attDate: { userId: params.userId, attDate: params.attDate } },
      create: {
        userId: params.userId,
        attDate: params.attDate,
        status: 'LEAVE',
        workType: 'LEAVE',
        leaveRequestId: params.leaveRequestId,
        remarks: params.remarks,
        approvedById: params.actorId,
        serverAt: new Date(),
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        status: 'LEAVE',
        workType: 'LEAVE',
        leaveRequestId: params.leaveRequestId,
        remarks: params.remarks,
        checkInAt: null,
        checkOutAt: null,
        workingMins: null,
        approvedById: params.actorId,
        deletedAt: null,
        updatedBy: params.actorId,
      },
    });
  }

  /** Releases the rows a (now cancelled) leave request had created. */
  public deleteLeaveDays(leaveRequestId: number) {
    return this.prisma.attendance.deleteMany({ where: { leaveRequestId } });
  }

  /** Every row for one user inside a window — the month calendar reads this. */
  public listForUserRange(userId: number, from: Date, to: Date) {
    return this.prisma.attendance.findMany({
      where: { userId, deletedAt: null, attDate: { gte: from, lte: to } },
      orderBy: { attDate: 'asc' },
    });
  }

  /** Status counts + total working minutes for one user inside a window. */
  public async summarize(userId: number, from: Date, to: Date) {
    const where: Prisma.AttendanceWhereInput = {
      userId,
      deletedAt: null,
      attDate: { gte: from, lte: to },
    };
    const [grouped, aggregate] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.attendance.aggregate({ where, _sum: { workingMins: true } }),
    ]);
    return {
      byStatus: grouped.map((row) => ({ status: row.status, count: row._count._all })),
      workingMins: aggregate._sum.workingMins ?? 0,
    };
  }

  public update(id: number, data: Prisma.AttendanceUpdateInput) {
    return this.prisma.attendance.update({
      where: { id },
      data,
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    userId?: number;
    userIds?: number[];
    status?: AttendanceStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.userIds && params.userIds.length > 0
        ? { userId: { in: params.userIds } }
        : {}),
      ...(params.from || params.to
        ? {
            attDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ attDate: 'desc' }, { id: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { items, total };
  }

  public listReportUserIds(managerId: number): Promise<number[]> {
    return this.prisma.user
      .findMany({
        where: { managerId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));
  }

  public listFieldUsers(params: { roles: Array<'MR' | 'MANAGER'>; managerId?: number }) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        role: { in: params.roles },
        ...(params.managerId
          ? {
              OR: [{ id: params.managerId }, { managerId: params.managerId }],
            }
          : {}),
      },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }
}
