import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Distribution {
  id: string;
  visitId: string;
  medicineId: string;
  medicineName: string;
  doctorId: string;
  doctorName: string;
  mrId: string;
  mrName: string;
  quantity: number;
  batchNumber: string | null;
  remarks: string | null;
  distributedAt: string;
  visitDate: string;
}

export const distributionsApi = {
  async list(): Promise<Distribution[]> {
    const { data } = await api.get<ApiSuccess<Distribution[]>>('/distributions');
    return data.data;
  },
};
