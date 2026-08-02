import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class DistributionRepository {
  private static instance: DistributionRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): DistributionRepository {
    if (!DistributionRepository.instance) {
      DistributionRepository.instance = new DistributionRepository();
    }
    return DistributionRepository.instance;
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: string;
    medicineId?: string;
    visitId?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.MedicineDistributionWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
      ...(params.visitId ? { visitId: params.visitId } : {}),
      ...(params.from || params.to
        ? {
            distributedAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.medicineDistribution.findMany({
        where,
        orderBy: { distributedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          medicine: { select: { id: true, name: true } },
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
          visit: { select: { id: true, visitDate: true } },
        },
      }),
      this.prisma.medicineDistribution.count({ where }),
    ]);

    return { items, total };
  }
}
