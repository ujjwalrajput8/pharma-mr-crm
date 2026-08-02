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

  public update(id: number, data: Prisma.MedicineUpdateInput): Promise<Medicine> {
    return this.prisma.medicine.update({ where: { id }, data });
  }

  public findById(id: number): Promise<MedicineWithStock | null> {
    return this.prisma.medicine.findFirst({
      where: { id, deletedAt: null },
      include: { stock: true },
    });
  }

  public softDelete(id: number, updatedBy?: number): Promise<Medicine> {
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
              { brandName: { contains: params.search, mode: 'insensitive' } },
              { genericName: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } },
              { composition: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
              { batchNumber: { contains: params.search, mode: 'insensitive' } },
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

  public async getDetailBundle(medicineId: number) {
    const [distributions, byMr, byDoctor] = await Promise.all([
      this.prisma.medicineDistribution.findMany({
        where: { medicineId, deletedAt: null },
        orderBy: { distributedAt: 'desc' },
        include: {
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
          visit: { select: { id: true, visitDate: true } },
        },
      }),
      this.prisma.medicineDistribution.groupBy({
        by: ['mrId'],
        where: { medicineId, deletedAt: null },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.medicineDistribution.groupBy({
        by: ['doctorId'],
        where: { medicineId, deletedAt: null },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
    ]);

    const mrIds = byMr.map((row) => row.mrId);
    const doctorIds = byDoctor.map((row) => row.doctorId);
    const [mrs, doctors] = await Promise.all([
      mrIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
      doctorIds.length
        ? this.prisma.doctor.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
    ]);
    const mrMap = new Map(mrs.map((m) => [m.id, m]));
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    return {
      distributions,
      mrWise: byMr.map((row) => ({
        mrId: row.mrId,
        fullName: mrMap.get(row.mrId)?.fullName ?? 'Unknown',
        email: mrMap.get(row.mrId)?.email ?? null,
        quantity: row._sum.quantity ?? 0,
        issues: row._count._all,
      })),
      doctorWise: byDoctor.map((row) => ({
        doctorId: row.doctorId,
        fullName: doctorMap.get(row.doctorId)?.fullName ?? 'Unknown',
        quantity: row._sum.quantity ?? 0,
        issues: row._count._all,
      })),
    };
  }
}
