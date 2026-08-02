import type { CreateMedicineIssueDto, ListMedicineIssuesQueryDto } from '../dto/medicine-issue.dto';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { MedicineIssueRepository } from '../repositories/MedicineIssueRepository';
import { AppRoles } from '../constants';
import type { AuthUser } from '../types/auth.types';

/**
 * MedicineIssueService — Admin issues company samples to MR bag stock.
 * Decrements company Stock.available / increments issued; upserts MrStock.
 */
export class MedicineIssueService {
  private static instance: MedicineIssueService | null = null;
  private constructor(private readonly issues = MedicineIssueRepository.getInstance()) {}
  public static getInstance(): MedicineIssueService {
    if (!MedicineIssueService.instance) MedicineIssueService.instance = new MedicineIssueService();
    return MedicineIssueService.instance;
  }

  public async list(query: ListMedicineIssuesQueryDto, actor: AuthUser) {
    const { items, total } = await this.issues.list({
      page: query.page,
      limit: query.limit,
      mrId: actor.role === AppRoles.MR ? actor.id : query.mrId,
      medicineId: query.medicineId,
    });
    return {
      items: items.map((item) => this.toPublic(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async create(dto: CreateMedicineIssueDto, actor: AuthUser) {
    const prisma = this.issues.getPrisma();
    const medicine = await prisma.medicine.findFirst({
      where: { id: dto.medicineId, deletedAt: null },
      include: { stock: true },
    });
    if (!medicine) throw new NotFoundError('Medicine not found');
    if (!medicine.stock || medicine.stock.deletedAt) {
      throw new BadRequestError('Company stock record missing for this medicine');
    }
    if (medicine.stock.available < dto.quantity) {
      throw new BadRequestError(
        `Insufficient company stock. Available: ${medicine.stock.available}`,
      );
    }

    const mr = await prisma.user.findFirst({
      where: { id: dto.mrId, role: AppRoles.MR, deletedAt: null },
    });
    if (!mr) throw new NotFoundError('MR not found');

    const issueDate = new Date(`${dto.issueDate}T00:00:00.000Z`);

    const created = await prisma.$transaction(async (tx) => {
      const issue = await tx.medicineIssue.create({
        data: {
          mrId: dto.mrId,
          medicineId: dto.medicineId,
          quantity: dto.quantity,
          batchNumber: dto.batchNumber ?? medicine.batchNumber,
          issueDate,
          remarks: dto.remarks,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        include: {
          medicine: { select: { id: true, name: true, batchNumber: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      });

      await tx.stock.update({
        where: { medicineId: dto.medicineId },
        data: {
          issued: { increment: dto.quantity },
          available: { decrement: dto.quantity },
          updatedBy: actor.id,
        },
      });

      await tx.mrStock.upsert({
        where: {
          mrId_medicineId: { mrId: dto.mrId, medicineId: dto.medicineId },
        },
        create: {
          mrId: dto.mrId,
          medicineId: dto.medicineId,
          quantity: dto.quantity,
          batchNumber: dto.batchNumber ?? medicine.batchNumber,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        update: {
          quantity: { increment: dto.quantity },
          batchNumber: dto.batchNumber ?? medicine.batchNumber,
          updatedBy: actor.id,
          deletedAt: null,
        },
      });

      await tx.stockMovement.create({
        data: {
          medicineId: dto.medicineId,
          mrId: dto.mrId,
          type: 'ISSUE',
          quantity: dto.quantity,
          remarks: dto.remarks ?? `Issued to MR ${mr.fullName}`,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });

      return issue;
    });

    return this.toPublic(created);
  }

  private toPublic(item: {
    id: number;
    quantity: number;
    batchNumber: string | null;
    issueDate: Date;
    remarks: string | null;
    medicine: { id: number; name: string; batchNumber: string | null };
    mr: { id: number; fullName: string; email: string };
  }) {
    return {
      id: item.id,
      quantity: item.quantity,
      batchNumber: item.batchNumber,
      issueDate: item.issueDate.toISOString().slice(0, 10),
      remarks: item.remarks,
      medicine: item.medicine,
      mr: item.mr,
    };
  }
}
