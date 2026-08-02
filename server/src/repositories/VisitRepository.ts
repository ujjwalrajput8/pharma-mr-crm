import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class VisitRepository {
  private static instance: VisitRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): VisitRepository {
    if (!VisitRepository.instance) {
      VisitRepository.instance = new VisitRepository();
    }
    return VisitRepository.instance;
  }

  public create(data: Prisma.VisitCreateInput) {
    return this.prisma.visit.create({
      data,
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
        products: {
          include: { medicine: { select: { id: true, name: true } } },
        },
      },
    });
  }

  public findById(id: string) {
    return this.prisma.visit.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
        products: {
          include: { medicine: { select: { id: true, name: true } } },
        },
      },
    });
  }

  public softDelete(id: string, updatedBy?: string) {
    return this.prisma.visit.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: string;
    doctorId?: string;
  }) {
    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.doctorId ? { doctorId: params.doctorId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: { visitDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
          products: {
            include: { medicine: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    return { items, total };
  }
}
