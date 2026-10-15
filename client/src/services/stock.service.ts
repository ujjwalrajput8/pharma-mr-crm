import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';
import type { LedgerTxn } from '@/services/ledger.service';

export interface StockItem {
  id: number;
  medicineId: number;
  medicineName: string;
  company: string | null;
  sku: string | null;
  openingStock: number;
  /** Receipts + MR returns + count-up adjustments. */
  received: number;
  /** Issued/transferred to MRs — Opening + Received − Issued − Write-off = Available. */
  issued: number;
  returned: number;
  writeOff: number;
  available: number;
  minimumStockAlert: number;
  isLow: boolean;
  updatedAt: string;
}

export interface AdjustStockPayload {
  medicineId: number;
  quantityDelta: number;
  remarks?: string;
}

export interface MyStockHolding {
  medicine: { id: number; name: string; company: string | null; sku: string | null };
  batch: { id: number; batchNo: string; expiryDate: string | null };
  qty: number;
  updatedAt: string;
}

export interface MyStockResult {
  holdings: MyStockHolding[];
  /** The caller's last 30 ledger movements (either side). */
  recent: LedgerTxn[];
}

export const stockApi = {
  async list(params?: { search?: string; lowOnly?: boolean }): Promise<StockItem[]> {
    const { data } = await api.get<ApiSuccess<StockItem[]>>('/stock', {
      params: {
        limit: 100,
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.lowOnly ? { lowOnly: true } : {}),
      },
    });
    return data.data;
  },

  async adjust(payload: AdjustStockPayload): Promise<StockItem> {
    const { data } = await api.post<ApiSuccess<StockItem>>('/stock/adjust', payload);
    return data.data;
  },

  async my(): Promise<MyStockResult> {
    const { data } = await api.get<ApiSuccess<MyStockResult>>('/stock/my');
    return data.data;
  },
};
