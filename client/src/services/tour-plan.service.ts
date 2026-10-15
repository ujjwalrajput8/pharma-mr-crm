import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';
import type { WorkType } from '@/services/attendance.service';

export type TourPlanStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';

export interface TourPlanCall {
  id: number;
  doctor: {
    id: number;
    fullName: string;
    category: string;
    specialization: string | null;
    phone: string | null;
    city: string | null;
  } | null;
  chemist: { id: number; name: string; phone: string | null; city: string | null } | null;
}

export interface TourPlanDay {
  id: number;
  planDate: string;
  workType: WorkType;
  notes: string | null;
  territory: { id: number; name: string; type: string } | null;
  jointWith: { id: number; fullName: string } | null;
  calls: TourPlanCall[];
}

export interface TourPlan {
  id: number;
  userId: number;
  user: { id: number; fullName: string; email: string; role: string } | null;
  month: string;
  status: TourPlanStatus;
  submittedAt: string | null;
  actedAt: string | null;
  remark: string | null;
  approvedBy: { id: number; fullName: string } | null;
  days: TourPlanDay[];
}

export interface MyTourPlanResponse {
  month: string;
  plan: TourPlan | null;
  managers: Array<{ id: number; fullName: string; role: string }>;
}

export interface TourPlanListRow {
  id: number;
  user: { id: number; fullName: string; email: string; role: string } | null;
  month: string;
  status: TourPlanStatus;
  submittedAt: string | null;
  actedAt: string | null;
  remark: string | null;
  counts: { days: number; fieldDays: number; calls: number };
}

/** A day as sent in PUT /tour-plans/my — ids only. */
export interface TourPlanDayPayload {
  planDate: string;
  territoryId?: number;
  workType: WorkType;
  jointWithUserId?: number;
  notes?: string;
  calls: Array<{ doctorId?: number; chemistId?: number }>;
}

export const TOUR_PLAN_STATUS_TONE: Record<
  TourPlanStatus,
  'neutral' | 'warning' | 'success' | 'danger' | 'primary'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  LOCKED: 'primary',
};

export const tourPlanApi = {
  async my(month: string): Promise<MyTourPlanResponse> {
    const { data } = await api.get<ApiSuccess<MyTourPlanResponse>>('/tour-plans/my', {
      params: { month },
    });
    return data.data;
  },
  async saveMy(month: string, days: TourPlanDayPayload[]): Promise<TourPlan> {
    const { data } = await api.put<ApiSuccess<TourPlan>>(
      '/tour-plans/my',
      { days },
      { params: { month } },
    );
    return data.data;
  },
  async submitMy(month: string): Promise<TourPlan> {
    const { data } = await api.post<ApiSuccess<TourPlan>>('/tour-plans/my/submit', null, {
      params: { month },
    });
    return data.data;
  },
  async today(): Promise<TourPlanDay | null> {
    const { data } = await api.get<ApiSuccess<TourPlanDay | null>>('/tour-plans/today');
    return data.data;
  },
  async list(
    params: { month?: string; status?: TourPlanStatus; userId?: number } = {},
  ): Promise<TourPlanListRow[]> {
    const { data } = await api.get<ApiSuccess<TourPlanListRow[]>>('/tour-plans', { params });
    return data.data;
  },
  async get(id: number): Promise<TourPlan> {
    const { data } = await api.get<ApiSuccess<TourPlan>>(`/tour-plans/${id}`);
    return data.data;
  },
  async decide(
    id: number,
    payload: { status: 'APPROVED' | 'REJECTED'; remark?: string },
  ): Promise<TourPlan> {
    const { data } = await api.post<ApiSuccess<TourPlan>>(`/tour-plans/${id}/decide`, payload);
    return data.data;
  },
};
