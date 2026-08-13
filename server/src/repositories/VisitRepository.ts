import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { StockTxnRepository } from './StockTxnRepository';

export class VisitRepository {
  private static instance: VisitRepository | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
  ) {}

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

  public async findById(id: number) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
        products: {
          include: { medicine: { select: { id: true, name: true } } },
        },
      },
    });
    if (!visit) return null;
    const samples = await this.stockTxns.findSamplesByVisitIds([visit.id]);
    return { ...visit, distributions: samples };
  }

  public softDelete(id: number, updatedBy?: number) {
    return this.prisma.visit.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: number;
    mrIds?: number[];
    doctorId?: number;
  }) {
    const where: Prisma.VisitWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.mrIds && params.mrIds.length > 0 ? { mrId: { in: params.mrIds } } : {}),
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
            include: {
              medicine: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);

    const samples = await this.stockTxns.findSamplesByVisitIds(items.map((item) => item.id));
    const samplesByVisit = new Map<number, typeof samples>();
    for (const sample of samples) {
      if (sample.refId == null) continue;
      const list = samplesByVisit.get(sample.refId) ?? [];
      list.push(sample);
      samplesByVisit.set(sample.refId, list);
    }

    return {
      items: items.map((item) => ({
        ...item,
        distributions: samplesByVisit.get(item.id) ?? [],
      })),
      total,
    };
  }
}
