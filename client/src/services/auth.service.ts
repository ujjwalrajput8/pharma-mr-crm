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

  /** Admin-only: mint a single-use reset link to hand over to the employee. */
  async requestResetLink(userId: number): Promise<{ resetUrl: string; expiresAt: string }> {
    const { data } = await api.post<ApiSuccess<{ resetUrl: string; expiresAt: string }>>(
      '/auth/reset-requests',
      { userId },
    );
    return data.data;
  },

  /** Public: redeem a reset link (?token=... on /reset-password). */
  async resetPassword(payload: { token: string; newPassword: string }): Promise<void> {
    await api.post('/auth/reset-password', payload);
  },
};
