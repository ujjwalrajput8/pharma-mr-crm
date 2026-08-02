import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface AppSetting {
  id: number;
  key: string;
  value: string;
  group: string;
  updatedAt: string;
}

export interface UpsertSettingPayload {
  key: string;
  value: string;
  group?: string;
}

export const settingsApi = {
  async list(group?: string): Promise<AppSetting[]> {
    const { data } = await api.get<ApiSuccess<AppSetting[]>>('/settings', {
      params: group ? { group } : undefined,
    });
    return data.data;
  },

  async upsert(payload: UpsertSettingPayload): Promise<AppSetting> {
    const { data } = await api.put<ApiSuccess<AppSetting>>('/settings', payload);
    return data.data;
  },
};
