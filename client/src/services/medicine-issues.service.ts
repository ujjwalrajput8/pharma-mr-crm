import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface MedicineIssue {
  id: number;
  quantity: number;
  batchNumber: string | null;
  issueDate: string;
  remarks: string | null;
  medicine: { id: number; name: string; batchNumber: string | null };
  mr: { id: number; fullName: string; email: string };
}

export interface CreateMedicineIssuePayload {
  mrId: number;
  medicineId: number;
  quantity: number;
  batchNumber?: string;
  issueDate: string;
  remarks?: string;
}

export const medicineIssuesApi = {
  async list(): Promise<MedicineIssue[]> {
    const { data } = await api.get<ApiSuccess<MedicineIssue[]>>('/medicine-issues');
    return data.data;
  },
  async create(payload: CreateMedicineIssuePayload): Promise<MedicineIssue> {
    const { data } = await api.post<ApiSuccess<MedicineIssue>>('/medicine-issues', payload);
    return data.data;
  },
};
