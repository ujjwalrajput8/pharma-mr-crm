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

  /**
   * Employee changes their own password. The server revokes every session on
   * success, so the caller must send the user back to the login screen.
   */
  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.post('/auth/change-password', payload);
  },

  async refresh(): Promise<AuthSessionPayload> {
    const { data } = await api.post<ApiSuccess<AuthSessionPayload>>('/auth/refresh');
    return data.data;
  },
};
