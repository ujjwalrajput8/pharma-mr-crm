import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Visit {
  id: string;
  appointmentId: string | null;
  doctorId: string;
  mrId: string;
  visitDate: string;
  visitTime: string | null;
  meetingDurationMin: number | null;
  discussionNotes: string | null;
  doctorFeedback: string | null;
  remarks: string | null;
  nextFollowUp: string | null;
  doctor: { id: string; fullName: string } | null;
  mr: { id: string; fullName: string; email: string } | null;
  products: Array<{ id: string; name: string }>;
}

export const visitsApi = {
  async list(): Promise<Visit[]> {
    const { data } = await api.get<ApiSuccess<Visit[]>>('/visits');
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/visits/${id}`);
  },
};
