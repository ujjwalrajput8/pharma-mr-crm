import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface StockItem {
  id: number;
  medicineId: number;
  medicineName: string;
  company: string | null;
  sku: string | null;
  openingStock: number;
  issued: number;
  returned: number;
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
};
