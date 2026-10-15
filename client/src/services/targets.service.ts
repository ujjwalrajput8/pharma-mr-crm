import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface SalesTarget {
  id: number;
  userId: number;
  user: { id: number; fullName: string; role: string } | null;
  medicineId: number | null;
  medicine: { id: number; name: string } | null;
  /** YYYY-MM */
  targetMonth: string;
  targetAmount: number;
  targetUnits: number | null;
}

export interface UpsertTargetPayload {
  userId: number;
  /** YYYY-MM */
  targetMonth: string;
  medicineId?: number | null;
  targetAmount: number;
  targetUnits?: number | null;
}

export interface TargetProgressRow {
  userId: number;
  fullName: string;
  role: string;
  targetId: number | null;
  targetAmount: number;
  targetUnits: number | null;
  achievedAmount: number;
  pct: number | null;
}

export interface TargetProgress {
  month: string;
  rows: TargetProgressRow[];
  totals: { targetAmount: number; achievedAmount: number; pct: number | null };
}

export const targetsApi = {
  async list(params: { month?: string; userId?: number } = {}): Promise<SalesTarget[]> {
    const { data } = await api.get<ApiSuccess<SalesTarget[]>>('/targets', { params });
    return data.data;
  },
  async upsert(payload: UpsertTargetPayload): Promise<SalesTarget> {
    const { data } = await api.post<ApiSuccess<SalesTarget>>('/targets', payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/targets/${id}`);
  },
  async progress(params: { month?: string; userId?: number } = {}): Promise<TargetProgress> {
    const { data } = await api.get<ApiSuccess<TargetProgress>>('/targets/progress', { params });
    return data.data;
  },
};
