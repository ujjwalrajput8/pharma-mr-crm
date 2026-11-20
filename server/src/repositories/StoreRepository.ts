import type { MedicalStore, Prisma } from '@prisma/client';
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

  public update(id: number, data: Prisma.MedicalStoreUpdateInput): Promise<MedicalStore> {
    return this.prisma.medicalStore.update({ where: { id }, data });
  }

  public findById(id: number): Promise<MedicalStore | null> {
    return this.prisma.medicalStore.findFirst({ where: { id, deletedAt: null } });
  }

  public softDelete(id: number, updatedBy?: number): Promise<MedicalStore> {
    return this.prisma.medicalStore.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
    type?: MedicalStore['type'];
  }) {
    const where: Prisma.MedicalStoreWhereInput = {
      deletedAt: null,
      ...(params.type ? { type: params.type } : {}),
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
        include: {
          // The MR whose MSL list has it (at most one active row).
          assignments: {
            where: { isActive: true, deletedAt: null },
            take: 1,
            select: { mr: { select: { id: true, fullName: true } } },
          },
        },
      }),
      this.prisma.medicalStore.count({ where }),
    ]);

    return { items, total };
  }
}
