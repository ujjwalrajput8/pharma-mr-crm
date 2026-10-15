import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';
import type { TourPlanDay, TourPlanCall } from '@/services/tour-plan.service';

export interface MyDayCall extends TourPlanCall {
  /** True when a visit / completed appointment already exists today. */
  done: boolean;
}

export interface MyDayTourPlanDay extends Omit<TourPlanDay, 'calls'> {
  calls: MyDayCall[];
}

export interface MyDaySnapshot {
  date: string;
  attendance: {
    id: number;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string;
    workType: string | null;
    workingMins: number | null;
  } | null;
  tourPlanDay: MyDayTourPlanDay | null;
  appointments: Array<{
    id: number;
    time: string;
    status: string;
    purpose: string | null;
    doctor: { id: number; fullName: string; phone: string | null } | null;
  }>;
  pendingFollowUps: Array<{
    id: number;
    visitDate: string;
    nextFollowUp: string;
    doctor: { id: number; fullName: string } | null;
  }>;
  leaveToday: {
    id: number;
    leaveType: { code: string; name: string; colorHex: string } | null;
    fromDate: string;
    toDate: string;
    dayPart: string;
  } | null;
  holidayToday: string | null;
  counts: { visitsThisMonth: number; appointmentsToday: number };
}

export const myDayApi = {
  async get(): Promise<MyDaySnapshot> {
    const { data } = await api.get<ApiSuccess<MyDaySnapshot>>('/my-day');
    return data.data;
  },
};
