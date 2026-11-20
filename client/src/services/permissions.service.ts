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

/** One MR menu switch (Manager & MR Access → MRs). */
export interface MrAccessItem {
  key: Permission;
  label: string;
  section: string;
}

export interface MrAccessState {
  items: MrAccessItem[];
  defaults: string[];
  enabled: string[];
  /** false while every MR follows the role defaults. */
  customized: boolean;
}

export const permissionsApi = {
  async getMrAccess(): Promise<MrAccessState> {
    const { data } = await api.get<ApiSuccess<MrAccessState>>('/permissions/mr');
    return data.data;
  },

  async setMrAccess(permissions: string[]): Promise<MrAccessState> {
    const { data } = await api.put<ApiSuccess<MrAccessState>>('/permissions/mr', { permissions });
    return data.data;
  },

  async resetMrAccess(): Promise<MrAccessState> {
    const { data } = await api.post<ApiSuccess<MrAccessState>>('/permissions/mr/reset');
    return data.data;
  },

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
