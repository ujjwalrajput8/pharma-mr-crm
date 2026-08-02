import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Medicine {
  id: number;
  name: string;
  brandName?: string | null;
  genericName?: string | null;
  company: string | null;
  category: string | null;
  strength: string | null;
  composition?: string | null;
  packSize: string | null;
  mrp: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
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
  brandName?: string;
  genericName?: string;
  company?: string;
  category?: string;
  strength?: string;
  composition?: string;
  packSize?: string;
  mrp: number;
  batchNumber?: string;
  expiryDate?: string;
  openingStock?: number;
  minimumStockAlert?: number;
  sampleAvailable?: boolean;
}

export interface MedicineDetails {
  profile: Medicine;
  stats: {
    samplesIssued: number;
    currentStock: number;
    remainingStock: number;
    openingStock: number;
    issuedStock: number;
    issuedToMr?: number;
    companyRemaining?: number;
    mrRecipients: number;
    doctorRecipients: number;
  };
  mrHoldings?: Array<{
    mrId: number;
    fullName: string;
    email: string;
    quantity: number;
    batchNumber: string | null;
  }>;
  mrWise: Array<{
    mrId: number;
    fullName: string;
    email: string | null;
    quantity: number;
    issues: number;
  }>;
  doctorWise: Array<{
    doctorId: number;
    fullName: string;
    quantity: number;
    issues: number;
  }>;
  timeline: Array<{
    id: number;
    date: string;
    quantity: number;
    batchNumber: string | null;
    doctorName: string;
    mrName: string;
    visitId: number;
    visitDate: string;
  }>;
}

export const medicinesApi = {
  async list(search?: string): Promise<Medicine[]> {
    const { data } = await api.get<ApiSuccess<Medicine[]>>('/medicines', {
      params: search ? { search } : undefined,
    });
    return data.data;
  },
  async getDetails(id: number): Promise<MedicineDetails> {
    const { data } = await api.get<ApiSuccess<MedicineDetails>>(`/medicines/${id}/details`);
    return data.data;
  },
  async create(payload: CreateMedicinePayload): Promise<Medicine> {
    const { data } = await api.post<ApiSuccess<Medicine>>('/medicines', payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/medicines/${id}`);
  },
};
