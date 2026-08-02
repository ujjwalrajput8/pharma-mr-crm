import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface AuditLogItem {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export const auditLogsApi = {
  async list(): Promise<AuditLogItem[]> {
    const { data } = await api.get<ApiSuccess<AuditLogItem[]>>('/audit-logs', {
      params: { limit: 50 },
    });
    return data.data;
  },
};
