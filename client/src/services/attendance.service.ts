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

export type WorkType = 'FIELD' | 'OFFICE' | 'JOINT_WORK' | 'LEAVE' | 'HOLIDAY';

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
  workType: WorkType | null;
  leaveRequestId: number | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  isMockLocation: boolean;
  locationNote: string | null;
  remarks: string | null;
  flagReason: string | null;
  mr: { id: number; fullName: string; email: string; role?: string } | null;
}

export interface AttendanceCalendarDay {
  date: string;
  weekday: number;
  isSunday: boolean;
  holiday: { name: string; type: string; isOptional: boolean } | null;
  status: AttendanceMarkStatus | null;
  workType: WorkType | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingHours: number | null;
  flagReason: string | null;
  remarks: string | null;
  isFuture: boolean;
}

export interface AttendanceCalendar {
  userId: number;
  month: string;
  days: AttendanceCalendarDay[];
  summary: Record<string, number> & { workingDays: number; workingHours: number };
}

export interface AttendanceSummary {
  userId: number;
  from: string;
  to: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  holiday: number;
  office: number;
  jointWork: number;
  flagged: number;
  workingHours: number;
}

export interface CheckInPayload {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  isMockLocation?: boolean;
  deviceAt?: string;
  workType?: WorkType;
  locationNote?: string;
  remarks?: string;
}

export interface ManageAttendancePayload {
  userId: number;
  attDate: string;
  status: AttendanceMarkStatus;
  workType?: WorkType;
  remarks?: string;
}

export const attendanceApi = {
  async list(params: { userId?: number; from?: string; to?: string } = {}): Promise<Attendance[]> {
    const { data } = await api.get<ApiSuccess<Attendance[]>>('/attendance', {
      params: { limit: 200, ...params },
    });
    return data.data;
  },
  async today(): Promise<Attendance | null> {
    const { data } = await api.get<ApiSuccess<Attendance | null>>('/attendance/today');
    return data.data;
  },
  async calendar(params: { userId?: number; month?: string } = {}): Promise<AttendanceCalendar> {
    const { data } = await api.get<ApiSuccess<AttendanceCalendar>>('/attendance/calendar', {
      params,
    });
    return data.data;
  },
  async summary(
    params: { userId?: number; month?: string; from?: string; to?: string } = {},
  ): Promise<AttendanceSummary> {
    const { data } = await api.get<ApiSuccess<AttendanceSummary>>('/attendance/summary', {
      params,
    });
    return data.data;
  },
  async checkIn(payload: CheckInPayload = {}): Promise<Attendance> {
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
  async fieldUsers(): Promise<
    Array<{ id: number; fullName: string; email: string; role: string; employeeCode: string | null }>
  > {
    const { data } = await api.get<
      ApiSuccess<
        Array<{
          id: number;
          fullName: string;
          email: string;
          role: string;
          employeeCode: string | null;
        }>
      >
    >('/attendance/field-users');
    return data.data;
  },
};

/**
 * Reads the browser's GPS before a check-in. Never rejects — a missing fix is
 * reported to the API, which flags the day instead of blocking the MR's fieldwork.
 */
export function readGeolocation(timeoutMs = 8000): Promise<{
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
}> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

export const ATTENDANCE_STATUS_META: Record<
  AttendanceMarkStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral'; color: string }
> = {
  PRESENT: { label: 'Present', tone: 'success', color: 'var(--color-success)' },
  LATE: { label: 'Late', tone: 'warning', color: 'var(--color-warning)' },
  ABSENT: { label: 'Absent', tone: 'danger', color: 'var(--color-danger)' },
  LEAVE: { label: 'Leave', tone: 'primary', color: 'var(--color-cal-visit)' },
  HOLIDAY: { label: 'Holiday', tone: 'neutral', color: 'var(--color-muted)' },
  OFFICE: { label: 'Office', tone: 'primary', color: 'var(--color-primary)' },
  JOINT_WORK: { label: 'Joint work', tone: 'primary', color: 'var(--color-cal-followup)' },
  FLAGGED: { label: 'Flagged', tone: 'warning', color: 'var(--color-warning)' },
};

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  FIELD: 'Field',
  OFFICE: 'Office',
  JOINT_WORK: 'Joint work',
  LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
};
