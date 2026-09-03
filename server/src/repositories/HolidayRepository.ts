import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

/**
 * HolidayRepository — company / territory holiday calendar.
 * Design Pattern: Repository + Singleton
 */
export class HolidayRepository {
  private static instance: HolidayRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): HolidayRepository {
    if (!HolidayRepository.instance) HolidayRepository.instance = new HolidayRepository();
    return HolidayRepository.instance;
  }

  public findById(id: number) {
    return this.prisma.holiday.findFirst({
      where: { id, deletedAt: null },
      include: { territory: { select: { id: true, name: true, type: true } } },
    });
  }

  public list(params: {
    from?: Date;
    to?: Date;
    territoryId?: number;
    includeInactive?: boolean;
  }) {
    const where: Prisma.HolidayWhereInput = {
      deletedAt: null,
      ...(params.includeInactive ? {} : { status: 'ACTIVE' }),
      ...(params.from || params.to
        ? {
            holidayDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      // Company-wide rows (null territory) always apply; territory rows only to that territory.
      ...(params.territoryId
        ? { OR: [{ territoryId: null }, { territoryId: params.territoryId }] }
        : {}),
    };

    return this.prisma.holiday.findMany({
      where,
      orderBy: { holidayDate: 'asc' },
      include: { territory: { select: { id: true, name: true, type: true } } },
    });
  }

  public create(data: Prisma.HolidayCreateInput) {
    return this.prisma.holiday.create({
      data,
      include: { territory: { select: { id: true, name: true, type: true } } },
    });
  }

  public update(id: number, data: Prisma.HolidayUpdateInput) {
    return this.prisma.holiday.update({
      where: { id },
      data,
      include: { territory: { select: { id: true, name: true, type: true } } },
    });
  }

  public softDelete(id: number, actorId: number) {
    return this.prisma.holiday.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actorId },
    });
  }

  public findByDateAndName(holidayDate: Date, name: string) {
    return this.prisma.holiday.findFirst({ where: { holidayDate, name } });
  }
}
