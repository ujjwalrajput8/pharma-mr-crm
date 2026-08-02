import { api } from '@/api/client';
import type { ApiSuccess, AuthSessionPayload, AuthUser } from '@/types';

export const authApi = {
  async login(email: string, password: string): Promise<AuthSessionPayload> {
    const { data } = await api.post<ApiSuccess<AuthSessionPayload>>('/auth/login', {
      email,
      password,
    });
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<ApiSuccess<{ user: AuthUser }>>('/auth/me');
    return data.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async refresh(): Promise<AuthSessionPayload> {
    const { data } = await api.post<ApiSuccess<AuthSessionPayload>>('/auth/refresh');
    return data.data;
  },
};
