import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'mr-performance'
  | 'mr-detail'
  | 'doctor-visits'
  | 'appointments'
  | 'distributions'
  | 'stock'
  | 'sales';

export interface ReportFilters {
  type: ReportType;
  from?: string;
  to?: string;
  mrId?: string;
  doctorId?: string;
  medicineId?: string;
  medicalStoreId?: string;
  status?: string;
}

export interface ReportResult {
  type: ReportType;
  range: { from: string; to: string; label: string };
  summary: Record<string, number>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export const reportsApi = {
  async get(filters: ReportFilters): Promise<ReportResult> {
    const { data } = await api.get<ApiSuccess<ReportResult>>('/reports', {
      params: {
        type: filters.type,
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.mrId ? { mrId: filters.mrId } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.medicineId ? { medicineId: filters.medicineId } : {}),
        ...(filters.medicalStoreId ? { medicalStoreId: filters.medicalStoreId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
    });
    return data.data;
  },
};
