import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Medicine {
  id: string;
  name: string;
  company: string | null;
  category: string | null;
  strength: string | null;
  packSize: string | null;
  mrp: number;
  sampleAvailable: boolean;
  status: string;
  stock: {
    openingStock: number;
    issued: number;
    returned: number;
    available: number;
    minimumStockAlert: number;
    isLow: boolean;
  } | null;
}

export interface CreateMedicinePayload {
  name: string;
  company?: string;
  category?: string;
  strength?: string;
  packSize?: string;
  mrp: number;
  openingStock?: number;
  minimumStockAlert?: number;
  sampleAvailable?: boolean;
}

export const medicinesApi = {
  async list(search?: string): Promise<Medicine[]> {
    const { data } = await api.get<ApiSuccess<Medicine[]>>('/medicines', {
      params: search ? { search } : undefined,
    });
    return data.data;
  },
  async create(payload: CreateMedicinePayload): Promise<Medicine> {
    const { data } = await api.post<ApiSuccess<Medicine>>('/medicines', payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/medicines/${id}`);
  },
};
