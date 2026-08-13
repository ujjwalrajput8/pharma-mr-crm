import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type AppointmentStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface AppointmentActor {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface Appointment {
  id: number;
  doctorId: number;
  mrId: number;
  assignedById: number | null;
  date: string;
  time: string;
  purpose: string | null;
  status: AppointmentStatus;
  remarks: string | null;
  doctor: { id: number; fullName: string } | null;
  mr: { id: number; fullName: string; email: string } | null;
  createdBy: AppointmentActor | null;
  assignedBy: AppointmentActor | null;
}

export interface AssignableMr {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface CreateAppointmentPayload {
  doctorId: number;
  mrId?: number;
  date: string;
  time: string;
  purpose?: string;
  remarks?: string;
  status?: AppointmentStatus;
}

export interface UpdateAppointmentPayload {
  doctorId?: number;
  mrId?: number;
  date?: string;
  time?: string;
  purpose?: string;
  remarks?: string;
  status?: Exclude<AppointmentStatus, 'COMPLETED'>;
}

export interface CompleteAppointmentPayload {
  visitDate: string;
  visitTime: string;
  checkInTime?: string;
  checkOutTime?: string;
  meetingDurationMin?: number;
  discussionNotes?: string;
  doctorFeedback?: string;
  visitOutcome?: string;
  nextFollowUp?: string;
  remarks?: string;
  medicineIds?: number[];
  products?: Array<{ medicineId: number; notes?: string }>;
  distributions?: Array<{
    medicineId: number;
    quantity: number;
    batchNumber?: string;
    unit?: string;
    remarks?: string;
  }>;
}

export const appointmentsApi = {
  async list(params?: {
    limit?: number;
    status?: AppointmentStatus;
    mrId?: number;
  }): Promise<Appointment[]> {
    const { data } = await api.get<ApiSuccess<Appointment[]>>('/appointments', {
      params: {
        limit: params?.limit ?? 100,
        status: params?.status,
        mrId: params?.mrId,
      },
    });
    return data.data;
  },

  async listAssignableMrs(): Promise<AssignableMr[]> {
    const { data } = await api.get<ApiSuccess<AssignableMr[]>>('/appointments/assignable-mrs');
    return data.data;
  },

  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const { data } = await api.post<ApiSuccess<Appointment>>('/appointments', payload);
    return data.data;
  },
  async update(id: number, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const { data } = await api.patch<ApiSuccess<Appointment>>(`/appointments/${id}`, payload);
    return data.data;
  },

  async reschedule(
    id: number,
    payload: { date: string; time: string; remarks?: string },
  ): Promise<Appointment> {
    const { data } = await api.post<ApiSuccess<Appointment>>(
      `/appointments/${id}/reschedule`,
      payload,
    );
    return data.data;
  },

  async updateStatus(
    id: number,
    status: 'PENDING' | 'CANCELLED' | 'RESCHEDULED',
  ): Promise<Appointment> {
    return this.update(id, { status });
  },
  async complete(id: number, payload: CompleteAppointmentPayload): Promise<unknown> {
    const { data } = await api.post(`/appointments/${id}/complete`, payload);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/appointments/${id}`);
  },
};
