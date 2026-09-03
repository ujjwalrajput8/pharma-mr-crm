import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveDayPart = 'FULL' | 'FIRST_HALF' | 'SECOND_HALF';

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  annualQuota: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForward: number;
  allowHalfDay: boolean;
  requiresProof: boolean;
  colorHex: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface LeaveRequest {
  id: number;
  userId: number;
  employee: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    employeeCode: string | null;
    designation: string | null;
  } | null;
  leaveType: {
    id: number;
    code: string;
    name: string;
    colorHex: string;
    isPaid: boolean;
  } | null;
  fromDate: string;
  toDate: string;
  dayPart: LeaveDayPart;
  days: number;
  reason: string;
  contactPhone: string | null;
  attachmentUrl: string | null;
  status: LeaveStatus;
  decisionRemark: string | null;
  actedAt: string | null;
  approvedBy: { id: number; fullName: string; role: string } | null;
  createdAt: string;
}

export interface LeaveBalance {
  leaveTypeId: number;
  code: string;
  name: string;
  colorHex: string;
  isPaid: boolean;
  allowHalfDay: boolean;
  requiresProof: boolean;
  opening: number;
  allocated: number;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
  unlimited: boolean;
}

export interface ApplyLeavePayload {
  leaveTypeId: number;
  fromDate: string;
  toDate: string;
  dayPart: LeaveDayPart;
  reason: string;
  contactPhone?: string;
  attachmentUrl?: string;
  userId?: number;
}

export interface ListLeavesParams {
  userId?: number;
  status?: LeaveStatus;
  leaveTypeId?: number;
  year?: number;
  from?: string;
  to?: string;
  limit?: number;
}

export const leavesApi = {
  async list(params: ListLeavesParams = {}): Promise<LeaveRequest[]> {
    const { data } = await api.get<ApiSuccess<LeaveRequest[]>>('/leaves', {
      params: { limit: 100, ...params },
    });
    return data.data;
  },
  async apply(payload: ApplyLeavePayload): Promise<LeaveRequest> {
    const { data } = await api.post<ApiSuccess<LeaveRequest>>('/leaves', payload);
    return data.data;
  },
  async decide(
    id: number,
    payload: { status: 'APPROVED' | 'REJECTED'; decisionRemark?: string },
  ): Promise<LeaveRequest> {
    const { data } = await api.post<ApiSuccess<LeaveRequest>>(`/leaves/${id}/decision`, payload);
    return data.data;
  },
  async cancel(id: number, reason?: string): Promise<LeaveRequest> {
    const { data } = await api.post<ApiSuccess<LeaveRequest>>(`/leaves/${id}/cancel`, { reason });
    return data.data;
  },
  async pendingCount(): Promise<number> {
    const { data } = await api.get<ApiSuccess<{ count: number }>>('/leaves/pending-count');
    return data.data.count;
  },

  async balances(
    params: { userId?: number; year?: number } = {},
  ): Promise<{ year: number; userId: number; balances: LeaveBalance[] }> {
    const { data } = await api.get<
      ApiSuccess<{ year: number; userId: number; balances: LeaveBalance[] }>
    >('/leaves/balances', { params });
    return data.data;
  },
  async setBalance(payload: {
    userId: number;
    leaveTypeId: number;
    year: number;
    opening: number;
    allocated: number;
  }): Promise<unknown> {
    const { data } = await api.post<ApiSuccess<unknown>>('/leaves/balances', payload);
    return data.data;
  },

  async types(includeInactive = false): Promise<LeaveType[]> {
    const { data } = await api.get<ApiSuccess<LeaveType[]>>('/leaves/types', {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return data.data;
  },
  async createType(payload: Partial<LeaveType>): Promise<{ id: number }> {
    const { data } = await api.post<ApiSuccess<{ id: number }>>('/leaves/types', payload);
    return data.data;
  },
  async updateType(id: number, payload: Partial<LeaveType>): Promise<{ id: number }> {
    const { data } = await api.patch<ApiSuccess<{ id: number }>>(`/leaves/types/${id}`, payload);
    return data.data;
  },
  async removeType(id: number): Promise<void> {
    await api.delete(`/leaves/types/${id}`);
  },
};

export const LEAVE_STATUS_TONE: Record<LeaveStatus, 'warning' | 'success' | 'danger' | 'neutral'> =
  {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
  };

export const DAY_PART_LABEL: Record<LeaveDayPart, string> = {
  FULL: 'Full day',
  FIRST_HALF: 'First half',
  SECOND_HALF: 'Second half',
};
