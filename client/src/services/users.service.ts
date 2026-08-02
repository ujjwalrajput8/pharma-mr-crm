import { api } from '@/api/client';
import type { ApiSuccess, AuthUser } from '@/types';

export interface MrUser extends AuthUser {
  phone: string | null;
  employeeCode: string | null;
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
  employeeCode: string;
  address?: string;
  joiningDate?: string;
  assignedArea?: string;
}

export const usersApi = {
  async list(): Promise<MrUser[]> {
    const { data } = await api.get<ApiSuccess<MrUser[]>>('/users');
    return data.data;
  },
  async create(payload: CreateMrPayload): Promise<MrUser> {
    const { data } = await api.post<ApiSuccess<MrUser>>('/users', payload);
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
