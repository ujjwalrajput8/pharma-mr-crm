import type { Medicine, Prisma, Stock } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

type MedicineWithStock = Medicine & { stock: Stock | null };

export class MedicineRepository {
  private static instance: MedicineRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): MedicineRepository {
    if (!MedicineRepository.instance) {
      MedicineRepository.instance = new MedicineRepository();
    }
    return MedicineRepository.instance;
  }

  public getPrisma() {
    return this.prisma;
  }

  public async createWithStock(
    data: Prisma.MedicineCreateInput,
    openingStock: number,
    minimumStockAlert: number,
  ): Promise<MedicineWithStock> {
    const createdBy = typeof data.createdBy === 'string' ? data.createdBy : undefined;
    const updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : undefined;

    return this.prisma.medicine.create({
      data: {
        ...data,
        stock: {
          create: {
            openingStock,
            issued: 0,
            returned: 0,
            available: openingStock,
            minimumStockAlert,
            createdBy,
            updatedBy,
          },
        },
      },
      include: { stock: true },
    });
  }

  public update(id: string, data: Prisma.MedicineUpdateInput): Promise<Medicine> {
    return this.prisma.medicine.update({ where: { id }, data });
  }

  public findById(id: string): Promise<MedicineWithStock | null> {
    return this.prisma.medicine.findFirst({
      where: { id, deletedAt: null },
      include: { stock: true },
    });
  }

  public softDelete(id: string, updatedBy?: string): Promise<Medicine> {
    return this.prisma.medicine.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
  }): Promise<{ items: MedicineWithStock[]; total: number }> {
    const where: Prisma.MedicineWhereInput = {
      deletedAt: null,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } },
              { composition: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { stock: true },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return { items, total };
  }

  public countAll(): Promise<number> {
    return this.prisma.medicine.count({ where: { deletedAt: null } });
  }
}
