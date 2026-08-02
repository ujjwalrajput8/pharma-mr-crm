import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface DashboardSummary {
  role: 'ADMIN' | 'MR';
  cards: Record<string, number>;
  insights?: {
    topPerformingMrs?: Array<{ mrId: number; fullName: string; visits: number; sales: number }>;
    topPrescribedMedicines?: Array<{ medicineId: number; name: string; samples: number }>;
    mrWiseSales?: Array<{ mrId: number; fullName: string; amount: number }>;
    medicineWiseSales?: Array<{
      medicineId: number;
      name: string;
      amount: number;
      quantity?: number;
    }>;
    performanceGraph?: Array<{ date: string; visits: number }>;
  };
}

export const dashboardApi = {
  async summary(): Promise<DashboardSummary> {
    const { data } = await api.get<ApiSuccess<DashboardSummary>>('/dashboard/summary');
    return data.data;
  },
};
