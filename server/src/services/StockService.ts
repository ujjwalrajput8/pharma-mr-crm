import type { AdjustStockDto, ListStockQueryDto } from '../dto/stock.dto';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { StockRepository, type StockWithMedicine } from '../repositories/StockRepository';

/**
 * StockService — inventory listing and manual adjustments.
 * Sample ISSUE decrements happen in AppointmentService.completeWithVisit.
 * Design Pattern: Singleton + Service Layer
 */
export class StockService {
  private static instance: StockService | null = null;

  private constructor(private readonly stocks = StockRepository.getInstance()) {}

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

  public async adjust(dto: AdjustStockDto, actorId: number) {
    try {
      const stock = await this.stocks.adjustAvailable({
        medicineId: dto.medicineId,
        quantityDelta: dto.quantityDelta,
        remarks: dto.remarks,
        actorId,
      });
      return this.toPublic(stock);
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

  private toPublic(stock: StockWithMedicine) {
    return {
      id: stock.id,
      medicineId: stock.medicineId,
      medicineName: stock.medicine.name,
      company: stock.medicine.company,
      sku: stock.medicine.sku,
      openingStock: stock.openingStock,
      issued: stock.issued,
      returned: stock.returned,
      available: stock.available,
      minimumStockAlert: stock.minimumStockAlert,
      isLow: stock.available <= stock.minimumStockAlert,
      updatedAt: stock.updatedAt,
    };
  }
}
