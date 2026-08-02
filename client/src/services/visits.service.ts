import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Visit {
  id: number;
  appointmentId: number | null;
  doctorId: number;
  mrId: number;
  visitDate: string;
  visitTime: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  meetingDurationMin: number | null;
  discussionNotes: string | null;
  doctorFeedback: string | null;
  visitOutcome?: string | null;
  remarks: string | null;
  nextFollowUp: string | null;
  doctor: { id: number; fullName: string } | null;
  mr: { id: number; fullName: string; email: string } | null;
  products: Array<{ id: number; name: string; notes?: string | null }>;
  distributions: Array<{
    id: number;
    medicineId: number;
    medicineName: string;
    quantity: number;
    batchNumber: string | null;
    remarks: string | null;
  }>;
}

export const visitsApi = {
  async list(): Promise<Visit[]> {
    const { data } = await api.get<ApiSuccess<Visit[]>>('/visits', {
      params: { limit: 100 },
    });
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/visits/${id}`);
  },
};
