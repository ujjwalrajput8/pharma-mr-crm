import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type MslParty = 'DOCTOR' | 'CHEMIST' | 'STOCKIST';
export type MslAction = 'ADD' | 'REMOVE';
export type MslStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const MSL_PARTY_LABEL: Record<MslParty, string> = { DOCTOR: 'Doctor', CHEMIST: 'Chemist', STOCKIST: 'Stockist' };

export interface MslRequest {
  id: number;
  action: MslAction;
  party: MslParty;
  status: MslStatus;
  mr: { id: number; fullName: string };
  doctor: { id: number; fullName: string; mslNo: string; area: string | null } | null;
  store: { id: number; name: string; type: 'CHEMIST' | 'STOCKIST'; city: string | null } | null;
  details: Record<string, string | null | undefined> | null;
  reason: string | null;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  /** "Add Dr. X" / "Remove Y" */
  subject: string;
  /** Team view, pending ADD: existing records that look the same. */
  similar?: Array<{ id: number; name: string; info: string }>;
}

export interface CreateMslRequestPayload {
  action: MslAction;
  party: MslParty;
  doctorId?: number;
  storeId?: number;
  details?: Record<string, string | undefined>;
  reason?: string;
}

export const mslApi = {
  async list(params: { scope: 'mine' | 'team'; status?: MslStatus; party?: MslParty }): Promise<{ items: MslRequest[]; pending: number }> {
    const { data } = await api.get<ApiSuccess<MslRequest[]> & { meta: { pending: number } }>('/msl-requests', { params });
    return { items: data.data, pending: (data.meta as { pending: number } | undefined)?.pending ?? 0 };
  },
  async create(payload: CreateMslRequestPayload): Promise<MslRequest> {
    const { data } = await api.post<ApiSuccess<MslRequest>>('/msl-requests', payload);
    return data.data;
  },
  async cancel(id: number): Promise<MslRequest> {
    const { data } = await api.post<ApiSuccess<MslRequest>>(`/msl-requests/${id}/cancel`);
    return data.data;
  },
  async decide(id: number, payload: { action: 'APPROVE' | 'REJECT'; note?: string }): Promise<MslRequest> {
    const { data } = await api.post<ApiSuccess<MslRequest>>(`/msl-requests/${id}/decide`, payload);
    return data.data;
  },
};

export type ApprovalKind = 'tour-plan' | 'expense' | 'leave' | 'msl';

export interface MyApprovalItem {
  kind: ApprovalKind;
  id: number;
  title: string;
  detail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'OTHER';
  rawStatus: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
  href: string;
}

export const myApprovalsApi = {
  async list(): Promise<{ items: MyApprovalItem[]; pending: Record<ApprovalKind, number> }> {
    const { data } = await api.get<ApiSuccess<MyApprovalItem[]> & { meta: { pending: Record<ApprovalKind, number> } }>('/my-approvals');
    return { items: data.data, pending: (data.meta as { pending: Record<ApprovalKind, number> }).pending };
  },
};
