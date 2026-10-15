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

export interface DashboardTrends {
  from: string;
  to: string;
  days: number;
  visitsByDay: Array<{ date: string; visits: number; appointments: number }>;
  salesByDay: Array<{ date: string; amount: number }>;
  doctorCoverage: { visited: number; total: number };
  /** Approved leaves in range grouped by type — empty for MRs. */
  leaveDistribution: Array<{ code: string; name: string; colorHex: string; days: number }>;
  /** Top 5 sampled medicines in range. */
  topMedicines: Array<{ medicineId: number; name: string; qty: number }>;
}

export const dashboardApi = {
  async summary(): Promise<DashboardSummary> {
    const { data } = await api.get<ApiSuccess<DashboardSummary>>('/dashboard/summary');
    return data.data;
  },
  async trends(days = 30): Promise<DashboardTrends> {
    const { data } = await api.get<ApiSuccess<DashboardTrends>>('/dashboard/trends', {
      params: { days },
    });
    return data.data;
  },
};
