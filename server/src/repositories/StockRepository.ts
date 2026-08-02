import type { Prisma, Stock } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export type StockWithMedicine = Stock & {
  medicine: {
    id: number;
    name: string;
    company: string | null;
    sku: string | null;
    sampleAvailable: boolean;
    status: string;
  };
};

/**
 * StockRepository — data access for inventory rows and movements.
 * Design Pattern: Repository + Singleton
 */
export class StockRepository {
  private static instance: StockRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): StockRepository {
    if (!StockRepository.instance) {
      StockRepository.instance = new StockRepository();
    }
    return StockRepository.instance;
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
    lowOnly?: boolean;
  }): Promise<{ items: StockWithMedicine[]; total: number }> {
    const medicineFilter: Prisma.MedicineWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const where: Prisma.StockWhereInput = {
      deletedAt: null,
      medicine: medicineFilter,
    };

    if (params.lowOnly) {
      const all = await this.prisma.stock.findMany({
        where,
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              company: true,
              sku: true,
              sampleAvailable: true,
              status: true,
            },
          },
        },
        orderBy: { available: 'asc' },
      });
      const filtered = all.filter((row) => row.available <= row.minimumStockAlert);
      const start = (params.page - 1) * params.limit;
      return {
        items: filtered.slice(start, start + params.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              company: true,
              sku: true,
              sampleAvailable: true,
              status: true,
            },
          },
        },
        orderBy: { medicine: { name: 'asc' } },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { items, total };
  }

  public findByMedicineId(medicineId: number): Promise<StockWithMedicine | null> {
    return this.prisma.stock.findFirst({
      where: { medicineId, deletedAt: null },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            company: true,
            sku: true,
            sampleAvailable: true,
            status: true,
          },
        },
      },
    });
  }

  public async adjustAvailable(params: {
    medicineId: number;
    quantityDelta: number;
    remarks?: string;
    actorId: number;
  }): Promise<StockWithMedicine> {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.findFirst({
        where: { medicineId: params.medicineId, deletedAt: null },
      });
      if (!stock) {
        throw new Error('STOCK_NOT_FOUND');
      }

      const nextAvailable = stock.available + params.quantityDelta;
      if (nextAvailable < 0) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      const updated = await tx.stock.update({
        where: { id: stock.id },
        data: {
          available: nextAvailable,
          updatedBy: params.actorId,
        },
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              company: true,
              sku: true,
              sampleAvailable: true,
              status: true,
            },
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          medicineId: params.medicineId,
          type: 'ADJUSTMENT',
          quantity: Math.abs(params.quantityDelta),
          remarks:
            params.remarks ??
            `Manual stock adjustment (${params.quantityDelta > 0 ? '+' : ''}${params.quantityDelta})`,
          createdBy: params.actorId,
          updatedBy: params.actorId,
        },
      });

      return updated;
    });
  }
}
