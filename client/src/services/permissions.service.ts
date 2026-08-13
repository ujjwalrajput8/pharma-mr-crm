import { api } from '@/api/client';
import type { ApiSuccess, Permission } from '@/types';

export interface PermissionCatalogItem {
  key: Permission | string;
  label: string;
  group: string;
}

export interface ManagerPermissionSummary {
  id: number;
  fullName: string;
  email: string;
  status: string;
  permissionsCustomized: boolean;
  permissionCount: number;
}

export interface ManagerPermissionState {
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    permissionsCustomized: boolean;
  };
  catalog: PermissionCatalogItem[];
  defaults: string[];
  effective: string[];
}

export const permissionsApi = {
  async listManagers(): Promise<ManagerPermissionSummary[]> {
    const { data } = await api.get<ApiSuccess<ManagerPermissionSummary[]>>('/permissions/managers');
    return data.data;
  },

  async getManager(userId: number): Promise<ManagerPermissionState> {
    const { data } = await api.get<ApiSuccess<ManagerPermissionState>>(
      `/permissions/managers/${userId}`,
    );
    return data.data;
  },

  async setManager(userId: number, permissions: string[]): Promise<ManagerPermissionState> {
    const { data } = await api.put<ApiSuccess<ManagerPermissionState>>(
      `/permissions/managers/${userId}`,
      { permissions },
    );
    return data.data;
  },

  async resetManager(userId: number): Promise<ManagerPermissionState> {
    const { data } = await api.post<ApiSuccess<ManagerPermissionState>>(
      `/permissions/managers/${userId}/reset`,
    );
    return data.data;
  },
};
