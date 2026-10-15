import { randomBytes } from 'crypto';
import type { AdjustStockDto, ListStockQueryDto } from '../dto/stock.dto';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { HolderTypes } from '../constants';
import { StockRepository, type WarehouseStockRow } from '../repositories/StockRepository';
import { StockTxnRepository } from '../repositories/StockTxnRepository';
import { StockLedgerService } from './StockLedgerService';
import { LedgerQueryService } from './LedgerQueryService';
import { formatDateOnly, toLocalDateString, todayDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

/**
 * StockService — inventory listing and manual adjustments via stock ledger.
 */
export class StockService {
  private static instance: StockService | null = null;

  private constructor(
    private readonly stocks = StockRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
    private readonly ledgerQuery = LedgerQueryService.getInstance(),
  ) {}

  public static getInstance(): StockService {
    if (!StockService.instance) {
      StockService.instance = new StockService();
    }
    return StockService.instance;
  }

  public async list(query: ListStockQueryDto) {
    const { items, total } = await this.stocks.list({
      page: query.page,
      limit: query.limit,
      search: query.search,
      lowOnly: query.lowOnly,
    });

    const warehouseId = await this.ledger.findDefaultWarehouseId();
    const enriched = await Promise.all(
      items.map(async (item) => {
        const stats = await this.stockTxns.getWarehouseMedicineStats(warehouseId, item.medicineId);
        return this.toPublic(item, stats);
      }),
    );

    return {
      items: enriched,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async adjust(dto: AdjustStockDto, actorId: number) {
    try {
      const warehouseId = await this.ledger.getDefaultWarehouseId();
      const batch = await this.stockTxns.resolveBatchForIssue({
        medicineId: dto.medicineId,
        warehouseId,
        requiredQty: dto.quantityDelta < 0 ? Math.abs(dto.quantityDelta) : 1,
      });
      if (!batch) {
        throw new Error(dto.quantityDelta < 0 ? 'INSUFFICIENT_STOCK' : 'STOCK_NOT_FOUND');
      }

      const prisma = this.stockTxns.getPrisma();
      await prisma.$transaction(async (tx) => {
        // Stock added by hand is still goods received — record a receipt so the
        // ledger explorer can answer "kab aaya, kisne daala" for it too.
        let ref: { refType: 'RECEIPT'; refId: number } | undefined;
        if (dto.quantityDelta > 0) {
          const receipt = await tx.stockReceipt.create({
            data: {
              receiptNo: this.generateReceiptNo(),
              receiptDate: todayDateOnly(),
              source: 'Manual adjustment',
              note: dto.remarks ?? null,
              totalUnits: dto.quantityDelta,
              lineCount: 1,
              createdBy: actorId,
            },
            select: { id: true },
          });
          ref = { refType: 'RECEIPT', refId: receipt.id };
        }

        await this.ledger.postAdjustment({
          warehouseId,
          medicineId: dto.medicineId,
          batchId: batch.id,
          quantityDelta: dto.quantityDelta,
          txnDate: new Date(),
          note: dto.remarks,
          createdBy: actorId,
          ...(ref ?? {}),
          client: tx,
        });
      });

      const stock = await this.stocks.findByMedicineId(dto.medicineId);
      if (!stock) throw new Error('STOCK_NOT_FOUND');
      const stats = await this.stockTxns.getWarehouseMedicineStats(warehouseId, dto.medicineId);
      return this.toPublic(stock, stats);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'STOCK_NOT_FOUND') {
          throw new NotFoundError('Stock record not found for this medicine');
        }
        if (error.message === 'INSUFFICIENT_STOCK') {
          throw new BadRequestError('Adjustment would make available stock negative');
        }
      }
      throw error;
    }
  }

  /**
   * The signed-in user's own bag: USER-holder balances (qty > 0) with
   * medicine + batch + expiry, plus their last 30 ledger movements.
   */
  public async myStock(actor: AuthUser) {
    const prisma = this.stockTxns.getPrisma();
    const balances = await prisma.stockBalance.findMany({
      where: {
        holderType: HolderTypes.USER,
        holderId: actor.id,
        qty: { gt: 0 },
        medicine: { deletedAt: null },
      },
      include: {
        medicine: { select: { id: true, name: true, company: true, sku: true } },
        batch: { select: { id: true, batchNo: true, expiryDate: true } },
      },
      orderBy: [{ medicine: { name: 'asc' } }, { batch: { batchNo: 'asc' } }],
    });

    const { items: recent } = await this.ledgerQuery.listTxns({
      page: 1,
      limit: 30,
      holderType: HolderTypes.USER,
      holderId: actor.id,
    });

    return {
      holdings: balances.map((row) => ({
        medicine: row.medicine,
        batch: {
          id: row.batch.id,
          batchNo: row.batch.batchNo,
          expiryDate: row.batch.expiryDate ? formatDateOnly(row.batch.expiryDate) : null,
        },
        qty: row.qty,
        updatedAt: row.updatedAt.toISOString(),
      })),
      recent,
    };
  }

  /** `GRN-20261001-3F2A` — date is business-local, suffix is random. */
  private generateReceiptNo(): string {
    const stamp = toLocalDateString().replace(/-/g, '');
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    return `GRN-${stamp}-${suffix}`;
  }

  private toPublic(
    stock: WarehouseStockRow,
    stats: {
      openingStock: number;
      received: number;
      issued: number;
      returned: number;
      writeOff: number;
      available: number;
    },
  ) {
    const minimumStockAlert = 10;
    return {
      id: stock.medicineId,
      medicineId: stock.medicineId,
      medicineName: stock.medicine.name,
      company: stock.medicine.company,
      sku: stock.medicine.sku,
      openingStock: stats.openingStock,
      received: stats.received,
      issued: stats.issued,
      returned: stats.returned,
      writeOff: stats.writeOff,
      available: stats.available,
      minimumStockAlert,
      isLow: stats.available <= minimumStockAlert,
      batches: stock.batches,
      updatedAt: new Date(),
    };
  }
}
