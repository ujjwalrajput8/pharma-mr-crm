import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Sale {
  id: number;
  quantity: number;
  amount: number;
  invoiceDate: string;
  invoiceNumber: string | null;
  remarks: string | null;
  medicine: { id: number; name: string };
  doctor: { id: number; fullName: string } | null;
  medicalStore: { id: number; name: string } | null;
  mr: { id: number; fullName: string };
}

export interface CreateSalePayload {
  doctorId?: number;
  medicalStoreId?: number;
  medicineId: number;
  mrId?: number;
  quantity: number;
  amount: number;
  invoiceDate: string;
  invoiceNumber?: string;
  remarks?: string;
}

export const salesApi = {
  async list(): Promise<Sale[]> {
    const { data } = await api.get<ApiSuccess<Sale[]>>('/sales');
    return data.data;
  },
  async create(payload: CreateSalePayload): Promise<Sale> {
    const { data } = await api.post<ApiSuccess<Sale>>('/sales', payload);
    return data.data;
  },
};
