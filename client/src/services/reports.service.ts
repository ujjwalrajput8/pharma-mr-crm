import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'mr-performance'
  | 'doctor-visits'
  | 'appointments'
  | 'distributions'
  | 'stock';

export interface ReportResult {
  type: ReportType;
  range: { from: string; to: string; label: string };
  summary: Record<string, number>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export const reportsApi = {
  async get(type: ReportType, from?: string, to?: string): Promise<ReportResult> {
    const { data } = await api.get<ApiSuccess<ReportResult>>('/reports', {
      params: {
        type,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      },
    });
    return data.data;
  },
};
