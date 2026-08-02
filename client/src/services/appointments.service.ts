import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type AppointmentStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  doctorId: string;
  mrId: string;
  date: string;
  time: string;
  purpose: string | null;
  status: AppointmentStatus;
  remarks: string | null;
  doctor: { id: string; fullName: string } | null;
  mr: { id: string; fullName: string; email: string } | null;
}

export interface CreateAppointmentPayload {
  doctorId: string;
  mrId?: string;
  date: string;
  time: string;
  purpose?: string;
  remarks?: string;
}

export interface CompleteAppointmentPayload {
  visitDate: string;
  visitTime: string;
  meetingDurationMin?: number;
  discussionNotes?: string;
  doctorFeedback?: string;
  nextFollowUp?: string;
  remarks?: string;
  medicineIds?: string[];
  distributions?: Array<{
    medicineId: string;
    quantity: number;
    batchNumber?: string;
    remarks?: string;
  }>;
}

export const appointmentsApi = {
  async list(): Promise<Appointment[]> {
    const { data } = await api.get<ApiSuccess<Appointment[]>>('/appointments');
    return data.data;
  },
  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const { data } = await api.post<ApiSuccess<Appointment>>('/appointments', payload);
    return data.data;
  },
  async updateStatus(id: string, status: Exclude<AppointmentStatus, 'COMPLETED'>): Promise<Appointment> {
    const { data } = await api.patch<ApiSuccess<Appointment>>(`/appointments/${id}`, { status });
    return data.data;
  },
  async complete(id: string, payload: CompleteAppointmentPayload) {
    const { data } = await api.post<ApiSuccess<unknown>>(`/appointments/${id}/complete`, payload);
    return data.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/appointments/${id}`);
  },
};
