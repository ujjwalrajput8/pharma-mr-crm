import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type AttendanceMarkStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'OFFICE'
  | 'JOINT_WORK'
  | 'FLAGGED';

export interface Attendance {
  id: number;
  mrId: number;
  userId: number;
  workDate: string;
  attDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingMins: number | null;
  workingHours: number | null;
  status: AttendanceMarkStatus;
  locationNote: string | null;
  remarks: string | null;
  mr: { id: number; fullName: string; email: string; role?: string } | null;
}

export interface ManageAttendancePayload {
  userId: number;
  attDate: string;
  status: AttendanceMarkStatus;
  remarks?: string;
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
  async manage(payload: ManageAttendancePayload): Promise<Attendance> {
    const { data } = await api.post<ApiSuccess<Attendance>>('/attendance/manage', payload);
    return data.data;
  },
  async fieldUsers(): Promise<Array<{ id: number; fullName: string; email: string; role: string }>> {
    const { data } = await api.get<
      ApiSuccess<Array<{ id: number; fullName: string; email: string; role: string }>>
    >('/attendance/field-users');
    return data.data;
  },
};
