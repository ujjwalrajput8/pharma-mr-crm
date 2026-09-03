import type { CreateMedicineIssueDto, ListMedicineIssuesQueryDto } from '../dto/medicine-issue.dto';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { MedicineIssueRepository } from '../repositories/MedicineIssueRepository';
import { StockTxnRepository } from '../repositories/StockTxnRepository';
import { AppRoles, HolderTypes } from '../constants';
import { StockLedgerService } from './StockLedgerService';
import { TeamScopeService } from './TeamScopeService';
import type { AuthUser } from '../types/auth.types';

/**
 * MedicineIssueService — issues warehouse stock to MR via append-only ISSUE txns.
 */
export class MedicineIssueService {
  private static instance: MedicineIssueService | null = null;
  private constructor(
    private readonly issues = MedicineIssueRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}
  public static getInstance(): MedicineIssueService {
    if (!MedicineIssueService.instance) MedicineIssueService.instance = new MedicineIssueService();
    return MedicineIssueService.instance;
  }

  public async list(query: ListMedicineIssuesQueryDto, actor: AuthUser) {
    const mrFilter = await this.scope.resolveMrFilter(actor, query.mrId);
    const { items, total } = await this.issues.list({
      page: query.page,
      limit: query.limit,
      ...mrFilter,
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
    });
    if (!medicine) throw new NotFoundError('Medicine not found');

    const mr = await prisma.user.findFirst({
      where: { id: dto.mrId, role: AppRoles.MR, deletedAt: null },
    });
    if (!mr) throw new NotFoundError('MR not found');

    // A Manager can only load stock into their own reporting line.
    await this.scope.assertCanSee(actor, dto.mrId);

    const warehouseId = await this.ledger.getDefaultWarehouseId();
    const batch = await this.stockTxns.resolveBatchForIssue({
      medicineId: dto.medicineId,
      batchNumber: dto.batchNumber,
      warehouseId,
      requiredQty: dto.quantity,
    });
    if (!batch) {
      throw new BadRequestError('Insufficient warehouse stock for the requested batch');
    }

    const issueDate = new Date(`${dto.issueDate}T00:00:00.000Z`);

    const created = await this.ledger.issueToMr({
      fromHolderType: HolderTypes.WAREHOUSE,
      fromHolderId: warehouseId,
      mrId: dto.mrId,
      medicineId: dto.medicineId,
      batchId: batch.id,
      qty: dto.quantity,
      txnDate: issueDate,
      note: dto.remarks ?? `Issued to MR ${mr.fullName}`,
      createdBy: actor.id,
    });

    return this.toPublic({
      id: created.id,
      quantity: created.qty,
      batchNumber: batch.batchNo,
      issueDate: created.txnDate,
      remarks: created.note,
      medicine: { id: medicine.id, name: medicine.name },
      mr: { id: mr.id, fullName: mr.fullName, email: mr.email },
    });
  }

  private toPublic(item: {
    id: number;
    quantity: number;
    batchNumber: string | null;
    issueDate: Date;
    remarks: string | null;
    medicine: { id: number; name: string };
    mr: { id: number; fullName: string; email: string } | null;
  }) {
    return {
      id: item.id,
      quantity: item.quantity,
      batchNumber: item.batchNumber,
      issueDate: item.issueDate.toISOString().slice(0, 10),
      remarks: item.remarks,
      medicine: { ...item.medicine, batchNumber: item.batchNumber },
      mr: item.mr,
    };
  }
}
