import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class SaleRepository {
  private static instance: SaleRepository | null = null;
  private constructor(private readonly prisma = PrismaService.getClient()) {}
  public static getInstance(): SaleRepository {
    if (!SaleRepository.instance) SaleRepository.instance = new SaleRepository();
    return SaleRepository.instance;
  }

  public create(data: Prisma.SaleCreateInput) {
    return this.prisma.sale.create({
      data,
      include: {
        medicine: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true } },
        medicalStore: { select: { id: true, name: true } },
        mr: { select: { id: true, fullName: true } },
      },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: number;
    medicineId?: number;
    doctorId?: number;
    medicalStoreId?: number;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.SaleWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
      ...(params.doctorId ? { doctorId: params.doctorId } : {}),
      ...(params.medicalStoreId ? { medicalStoreId: params.medicalStoreId } : {}),
      ...(params.from || params.to
        ? {
            invoiceDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          medicine: { select: { id: true, name: true } },
          doctor: { select: { id: true, fullName: true } },
          medicalStore: { select: { id: true, name: true } },
          mr: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, total };
  }

  public sumAmount(where: Prisma.SaleWhereInput) {
    return this.prisma.sale.aggregate({
      where: { deletedAt: null, ...where },
      _sum: { amount: true },
    });
  }
}
