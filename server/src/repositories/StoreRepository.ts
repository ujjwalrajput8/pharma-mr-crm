import type { MedicalStore, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class StoreRepository {
  private static instance: StoreRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): StoreRepository {
    if (!StoreRepository.instance) {
      StoreRepository.instance = new StoreRepository();
    }
    return StoreRepository.instance;
  }

  public create(data: Prisma.MedicalStoreCreateInput): Promise<MedicalStore> {
    return this.prisma.medicalStore.create({ data });
  }

  public update(id: string, data: Prisma.MedicalStoreUpdateInput): Promise<MedicalStore> {
    return this.prisma.medicalStore.update({ where: { id }, data });
  }

  public findById(id: string): Promise<MedicalStore | null> {
    return this.prisma.medicalStore.findFirst({ where: { id, deletedAt: null } });
  }

  public softDelete(id: string, updatedBy?: string): Promise<MedicalStore> {
    return this.prisma.medicalStore.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ items: MedicalStore[]; total: number }> {
    const where: Prisma.MedicalStoreWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { gstNumber: { contains: params.search, mode: 'insensitive' } },
              { city: { contains: params.search, mode: 'insensitive' } },
              { ownerName: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.medicalStore.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.medicalStore.count({ where }),
    ]);

    return { items, total };
  }
}
