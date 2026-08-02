import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Doctor {
  id: string;
  fullName: string;
  specialization: string | null;
  hospital: string | null;
  clinic: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  visitingDays: string | null;
  preferredTime: string | null;
  status: string;
  assignedMrs: Array<{ id: string; fullName: string; email: string }>;
}

export interface CreateDoctorPayload {
  fullName: string;
  specialization?: string;
  hospital?: string;
  clinic?: string;
  email?: string;
  phone?: string;
  city?: string;
  visitingDays?: string;
  preferredTime?: string;
  mrId?: string;
}

export const doctorsApi = {
  async list(search?: string): Promise<Doctor[]> {
    const { data } = await api.get<ApiSuccess<Doctor[]>>('/doctors', {
      params: search ? { search } : undefined,
    });
    return data.data;
  },

  async create(payload: CreateDoctorPayload): Promise<Doctor> {
    const { data } = await api.post<ApiSuccess<Doctor>>('/doctors', payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/doctors/${id}`);
  },
};
