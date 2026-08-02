import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface MedicalStore {
  id: number;
  name: string;
  gstNumber: string | null;
  ownerName: string | null;
  drugLicenseNumber: string | null;
  phone: string | null;
  city: string | null;
  status: string;
}

export interface CreateStorePayload {
  name: string;
  gstNumber?: string;
  ownerName?: string;
  drugLicenseNumber?: string;
  phone?: string;
  city?: string;
}

export const storesApi = {
  async list(search?: string): Promise<MedicalStore[]> {
    const { data } = await api.get<ApiSuccess<MedicalStore[]>>('/stores', {
      params: search ? { search } : undefined,
    });
    return data.data;
  },
  async create(payload: CreateStorePayload): Promise<MedicalStore> {
    const { data } = await api.post<ApiSuccess<MedicalStore>>('/stores', payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/stores/${id}`);
  },
};
