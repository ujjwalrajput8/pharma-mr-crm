import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type HolidayType = 'NATIONAL' | 'FESTIVAL' | 'REGIONAL' | 'COMPANY' | 'WEEKLY_OFF';

export interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  type: HolidayType;
  isOptional: boolean;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  territory: { id: number; name: string; type: string } | null;
  weekday: string;
}

export interface HolidayPayload {
  holidayDate: string;
  name: string;
  type: HolidayType;
  isOptional: boolean;
  description?: string;
  territoryId?: number;
}

export type HolidayImportStatus = 'NEW' | 'RESTORE' | 'DUPLICATE_IN_FILE' | 'EXISTS' | 'INVALID';

/** POST /holidays/import — `dryRun` is the preview; the same call without it saves. */
export interface HolidayImportResult {
  dryRun: boolean;
  summary: { total: number; added: number; restored: number; duplicates: number; invalid: number };
  rows: Array<{
    rowNumber: number;
    date: string | null;
    name: string | null;
    type: HolidayType | null;
    isOptional: boolean;
    description: string | null;
    status: HolidayImportStatus;
    message: string | null;
  }>;
}

export const holidaysApi = {
  async import(payload: {
    fileName?: string;
    dryRun: boolean;
    rows: Array<{ rowNumber: number; values: Record<string, string | number> }>;
  }): Promise<HolidayImportResult> {
    const { data } = await api.post<ApiSuccess<HolidayImportResult>>('/holidays/import', payload);
    return data.data;
  },
  async list(params: { year?: number; from?: string; to?: string } = {}): Promise<Holiday[]> {
    const { data } = await api.get<ApiSuccess<Holiday[]>>('/holidays', { params });
    return data.data;
  },
  async create(payload: HolidayPayload): Promise<Holiday> {
    const { data } = await api.post<ApiSuccess<Holiday>>('/holidays', payload);
    return data.data;
  },
  async update(id: number, payload: Partial<HolidayPayload>): Promise<Holiday> {
    const { data } = await api.patch<ApiSuccess<Holiday>>(`/holidays/${id}`, payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/holidays/${id}`);
  },
};

export const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  NATIONAL: 'National',
  FESTIVAL: 'Festival',
  REGIONAL: 'Regional',
  COMPANY: 'Company',
  WEEKLY_OFF: 'Weekly off',
};
