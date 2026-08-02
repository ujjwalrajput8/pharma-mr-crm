import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class MedicineIssueRepository {
  private static instance: MedicineIssueRepository | null = null;
  private constructor(private readonly prisma = PrismaService.getClient()) {}
  public static getInstance(): MedicineIssueRepository {
    if (!MedicineIssueRepository.instance) {
      MedicineIssueRepository.instance = new MedicineIssueRepository();
    }
    return MedicineIssueRepository.instance;
  }

  public getPrisma() {
    return this.prisma;
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: number;
    medicineId?: number;
  }) {
    const where: Prisma.MedicineIssueWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.medicineIssue.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          medicine: { select: { id: true, name: true, batchNumber: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.medicineIssue.count({ where }),
    ]);
    return { items, total };
  }
}
