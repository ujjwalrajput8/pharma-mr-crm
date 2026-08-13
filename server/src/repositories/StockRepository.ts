import { StockTxnRepository } from './StockTxnRepository';
import { SettingRepository } from './SettingRepository';

export type WarehouseStockRow = {
  medicineId: number;
  medicine: {
    id: number;
    name: string;
    company: string | null;
    sku: string | null;
    sampleAvailable: boolean;
    status: string;
  };
  available: number;
  batches: Array<{ batchId: number; batchNo: string; expiryDate: Date | null; qty: number }>;
};

const DEFAULT_WAREHOUSE_SETTING = 'stock.default_warehouse_id';

/**
 * StockRepository — reads warehouse StockBalance rollups.
 */
export class StockRepository {
  private static instance: StockRepository | null = null;

  private constructor(
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly settings = SettingRepository.getInstance(),
  ) {}

  public static getInstance(): StockRepository {
    if (!StockRepository.instance) {
      StockRepository.instance = new StockRepository();
    }
    return StockRepository.instance;
  }

  private async getDefaultWarehouseId(): Promise<number> {
    const setting = await this.settings.findByKey(DEFAULT_WAREHOUSE_SETTING);
    if (!setting) throw new Error('DEFAULT_WAREHOUSE_NOT_CONFIGURED');
    const warehouseId = Number(setting.value);
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
      throw new Error('DEFAULT_WAREHOUSE_NOT_CONFIGURED');
    }
    return warehouseId;
  }

  public async list(params: {
    page: number;
    limit: number;
    search?: string;
    lowOnly?: boolean;
  }): Promise<{ items: WarehouseStockRow[]; total: number }> {
    const warehouseId = await this.getDefaultWarehouseId();
    return this.stockTxns.listWarehouseBalances({
      warehouseId,
      page: params.page,
      limit: params.limit,
      search: params.search,
      lowOnly: params.lowOnly,
    });
  }

  public async findByMedicineId(medicineId: number): Promise<WarehouseStockRow | null> {
    const warehouseId = await this.getDefaultWarehouseId();
    const { items } = await this.stockTxns.listWarehouseBalances({
      warehouseId,
      page: 1,
      limit: 1000,
    });
    return items.find((row) => row.medicineId === medicineId) ?? null;
  }
}
