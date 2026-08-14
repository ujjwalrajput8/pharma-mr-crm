import type { AttendanceStatus, Prisma } from '@prisma/client';
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
    inLat?: number;
    inLng?: number;
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
        locationNote: params.locationNote,
        remarks: params.remarks,
        status: 'PRESENT',
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
        locationNote: params.locationNote,
        remarks: params.remarks,
        status: 'PRESENT',
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
        remarks: params.remarks,
        ...(clearTimes ? { checkInAt: null, checkOutAt: null, workingMins: null } : {}),
        approvedById: params.actorId,
        deletedAt: null,
        updatedBy: params.actorId,
      },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
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
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
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
