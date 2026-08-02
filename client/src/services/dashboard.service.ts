import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface DashboardSummary {
  role: 'ADMIN' | 'MR';
  cards: Record<string, number>;
}

export const dashboardApi = {
  async summary(): Promise<DashboardSummary> {
    const { data } = await api.get<ApiSuccess<DashboardSummary>>('/dashboard/summary');
    return data.data;
  },
};
