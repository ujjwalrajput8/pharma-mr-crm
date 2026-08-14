import type { Batch, Medicine, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { StockTxnRepository } from './StockTxnRepository';
import { StockLedgerService } from '../services/StockLedgerService';

type MedicineWithBatches = Medicine & { batches: Batch[] };

export class MedicineRepository {
  private static instance: MedicineRepository | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
  ) {}

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
    batchNumber: string,
    expiryDate: Date | null,
    actorId: number,
  ): Promise<MedicineWithBatches> {
    return this.prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.create({ data });

      const batch = await this.stockTxns.createBatch(
        {
          medicineId: medicine.id,
          batchNo: batchNumber,
          expiryDate,
          status: 'ACTIVE',
          createdBy: actorId,
          updatedBy: actorId,
        },
        tx,
      );

      if (openingStock > 0) {
        const warehouseId = await this.ledger.getDefaultWarehouseId();
        await this.ledger.postOpening({
          warehouseId,
          medicineId: medicine.id,
          batchId: batch.id,
          qty: openingStock,
          txnDate: new Date(),
          createdBy: actorId,
          client: tx,
        });
      }

      return tx.medicine.findFirstOrThrow({
        where: { id: medicine.id },
        include: { batches: { where: { deletedAt: null } } },
      });
    });
  }

  public update(id: number, data: Prisma.MedicineUpdateInput): Promise<Medicine> {
    return this.prisma.medicine.update({ where: { id }, data });
  }

  public findById(id: number): Promise<MedicineWithBatches | null> {
    return this.prisma.medicine.findFirst({
      where: { id, deletedAt: null },
      include: { batches: { where: { deletedAt: null }, orderBy: { expiryDate: 'asc' } } },
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
  }): Promise<{ items: MedicineWithBatches[]; total: number }> {
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
              {
                batches: {
                  some: {
                    batchNo: { contains: params.search, mode: 'insensitive' },
                    deletedAt: null,
                  },
                },
              },
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
        include: { batches: { where: { deletedAt: null }, orderBy: { expiryDate: 'asc' } } },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return { items, total };
  }

  public countAll(): Promise<number> {
    return this.prisma.medicine.count({ where: { deletedAt: null } });
  }

  public getDetailBundle(medicineId: number) {
    return this.stockTxns.getMedicineSampleBundle(medicineId);
  }
}
