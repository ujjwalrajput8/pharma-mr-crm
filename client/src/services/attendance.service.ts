import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Attendance {
  id: number;
  mrId: number;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingMins: number | null;
  workingHours: number | null;
  locationNote: string | null;
  remarks: string | null;
  mr: { id: number; fullName: string; email: string } | null;
}

export const attendanceApi = {
  async list(): Promise<Attendance[]> {
    const { data } = await api.get<ApiSuccess<Attendance[]>>('/attendance', {
      params: { limit: 62 },
    });
    return data.data;
  },
  async today(): Promise<Attendance | null> {
    const { data } = await api.get<ApiSuccess<Attendance | null>>('/attendance/today');
    return data.data;
  },
  async checkIn(payload: { locationNote?: string; remarks?: string } = {}): Promise<Attendance> {
    const { data } = await api.post<ApiSuccess<Attendance>>('/attendance/check-in', payload);
    return data.data;
  },
  async checkOut(payload: { remarks?: string } = {}): Promise<Attendance> {
    const { data } = await api.post<ApiSuccess<Attendance>>('/attendance/check-out', payload);
    return data.data;
  },
};
