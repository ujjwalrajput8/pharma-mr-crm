import type { AdjustStockDto, ListStockQueryDto } from '../dto/stock.dto';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { StockRepository, type WarehouseStockRow } from '../repositories/StockRepository';
import { StockTxnRepository } from '../repositories/StockTxnRepository';
import { StockLedgerService } from './StockLedgerService';

/**
 * StockService — inventory listing and manual adjustments via stock ledger.
 */
export class StockService {
  private static instance: StockService | null = null;

  private constructor(
    private readonly stocks = StockRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
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

    const warehouseId = await this.ledger.getDefaultWarehouseId();
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

      await this.ledger.postAdjustment({
        warehouseId,
        medicineId: dto.medicineId,
        batchId: batch.id,
        quantityDelta: dto.quantityDelta,
        txnDate: new Date(),
        note: dto.remarks,
        createdBy: actorId,
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

  private toPublic(
    stock: WarehouseStockRow,
    stats: { openingStock: number; issued: number; returned: number; available: number },
  ) {
    const minimumStockAlert = 10;
    return {
      id: stock.medicineId,
      medicineId: stock.medicineId,
      medicineName: stock.medicine.name,
      company: stock.medicine.company,
      sku: stock.medicine.sku,
      openingStock: stats.openingStock,
      issued: stats.issued,
      returned: stats.returned,
      available: stats.available,
      minimumStockAlert,
      isLow: stats.available <= minimumStockAlert,
      batches: stock.batches,
      updatedAt: new Date(),
    };
  }
}
