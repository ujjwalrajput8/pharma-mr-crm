import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class AttendanceRepository {
  private static instance: AttendanceRepository | null = null;
  private constructor(private readonly prisma = PrismaService.getClient()) {}
  public static getInstance(): AttendanceRepository {
    if (!AttendanceRepository.instance) AttendanceRepository.instance = new AttendanceRepository();
    return AttendanceRepository.instance;
  }

  public findToday(mrId: number, workDate: Date) {
    return this.prisma.attendance.findFirst({
      where: { mrId, workDate, deletedAt: null },
    });
  }

  public upsertCheckIn(params: {
    mrId: number;
    workDate: Date;
    checkInAt: Date;
    latitude?: number;
    longitude?: number;
    locationNote?: string;
    remarks?: string;
    actorId: number;
  }) {
    return this.prisma.attendance.upsert({
      where: { mrId_workDate: { mrId: params.mrId, workDate: params.workDate } },
      create: {
        mrId: params.mrId,
        workDate: params.workDate,
        checkInAt: params.checkInAt,
        latitude: params.latitude,
        longitude: params.longitude,
        locationNote: params.locationNote,
        remarks: params.remarks,
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        checkInAt: params.checkInAt,
        checkOutAt: null,
        workingMins: null,
        latitude: params.latitude,
        longitude: params.longitude,
        locationNote: params.locationNote,
        remarks: params.remarks,
        deletedAt: null,
        updatedBy: params.actorId,
      },
    });
  }

  public update(id: number, data: Prisma.AttendanceUpdateInput) {
    return this.prisma.attendance.update({ where: { id }, data });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: number;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.from || params.to
        ? {
            workDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: { workDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { mr: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { items, total };
  }
}
