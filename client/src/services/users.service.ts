import { api } from '@/api/client';
import type { ApiSuccess, AuthUser, Role } from '@/types';

export interface MrUser extends AuthUser {
  phone: string | null;
  managerId: number | null;
  managerName: string | null;
  territoryId: number | null;
  employeeCode: string | null;
  designation: string | null;
  address: string | null;
  joiningDate: string | null;
  assignedArea: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMrPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: Extract<Role, 'MANAGER' | 'MR'>;
  managerId?: number;
  employeeCode: string;
  designation?: string;
  address?: string;
  joiningDate?: string;
  assignedArea?: string;
}

export interface UpdateMrPayload {
  fullName?: string;
  email?: string;
  phone?: string | null;
  role?: Extract<Role, 'MANAGER' | 'MR'>;
  managerId?: number | null;
  employeeCode?: string;
  designation?: string | null;
  address?: string | null;
  joiningDate?: string | null;
  assignedArea?: string | null;
}

export interface ManagerOption {
  id: number;
  fullName: string;
  email: string;
  designation: string | null;
}

export const usersApi = {
  async list(params: { role?: Role; search?: string } = {}): Promise<MrUser[]> {
    const { data } = await api.get<ApiSuccess<MrUser[]>>('/users', {
      params: { limit: 200, ...params },
    });
    return data.data;
  },
  async managerOptions(): Promise<ManagerOption[]> {
    const { data } = await api.get<ApiSuccess<ManagerOption[]>>('/users/manager-options');
    return data.data;
  },
  async create(payload: CreateMrPayload): Promise<MrUser> {
    const { data } = await api.post<ApiSuccess<MrUser>>('/users', payload);
    return data.data;
  },
  async update(id: number, payload: UpdateMrPayload): Promise<MrUser> {
    const { data } = await api.patch<ApiSuccess<MrUser>>(`/users/${id}`, payload);
    return data.data;
  },
  async activate(id: number): Promise<MrUser> {
    const { data } = await api.post<ApiSuccess<MrUser>>(`/users/${id}/activate`);
    return data.data;
  },
  async deactivate(id: number): Promise<MrUser> {
    const { data } = await api.post<ApiSuccess<MrUser>>(`/users/${id}/deactivate`);
    return data.data;
  },
  async resetPassword(id: number, password: string): Promise<MrUser> {
    const { data } = await api.post<ApiSuccess<MrUser>>(`/users/${id}/reset-password`, {
      password,
    });
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
