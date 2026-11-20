import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';
import type { AssignmentMove } from '@/services/doctors.service';

type MrBrief = AssignmentMove['from'];

export type StoreType = 'CHEMIST' | 'STOCKIST';

export const STORE_TYPE_LABEL: Record<StoreType, string> = { CHEMIST: 'Chemist', STOCKIST: 'Stockist' };

export interface MedicalStore {
  id: number;
  name: string;
  type: StoreType;
  gstNumber: string | null;
  ownerName: string | null;
  drugLicenseNumber: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  /** The MR whose MSL list has it. */
  assignedMr?: { id: number; fullName: string } | null;
}

export interface CreateStorePayload {
  name: string;
  type?: StoreType;
  gstNumber?: string;
  ownerName?: string;
  drugLicenseNumber?: string;
  phone?: string;
  city?: string;
}

/** A chemist / stockist in the signed-in MR's MSL list. */
export interface MyStore {
  id: number;
  name: string;
  type: StoreType;
  ownerName: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  status: string;
  territory: string | null;
  since: string;
}

/** One chemist / stockist that would change MR — the server asks first (409 CONFIRM_MOVE). */
export interface StoreMove {
  storeId: number;
  storeName: string;
  type: StoreType;
  from: MrBrief;
  to: MrBrief | null;
  planCalls: number;
}

export interface StoreAssignmentHistory {
  assignments: Array<{ mrId: number; mrName: string; active: boolean; from: string; to: string | null }>;
  changes: Array<{ action: string; at: string; by: { id: number; fullName: string } | null; note: string | null }>;
}

export const storesApi = {
  /** Every store (the page searches and sorts in the browser). */
  async list(params: { search?: string; type?: StoreType } = {}): Promise<MedicalStore[]> {
    const { data } = await api.get<ApiSuccess<MedicalStore[]>>('/stores', { params: { limit: 1000, ...params } });
    return data.data;
  },
  async create(payload: CreateStorePayload): Promise<MedicalStore> {
    const { data } = await api.post<ApiSuccess<MedicalStore>>('/stores', payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/stores/${id}`);
  },
  async mine(type?: StoreType): Promise<MyStore[]> {
    const { data } = await api.get<ApiSuccess<MyStore[]>>('/stores/mine', { params: type ? { type } : undefined });
    return data.data;
  },
  async assignMr(
    storeIds: number[],
    mrId: number | null,
    opts: { confirmMove?: boolean; note?: string } = {},
  ): Promise<{ changed: number; stores: number; mr: { id: number; fullName: string } | null }> {
    const { data } = await api.post<ApiSuccess<{ changed: number; stores: number; mr: { id: number; fullName: string } | null }>>(
      '/stores/assign-mr',
      { storeIds, mrId, ...(opts.confirmMove ? { confirmMove: true } : {}), ...(opts.note ? { note: opts.note } : {}) },
    );
    return data.data;
  },
  async assignmentHistory(id: number): Promise<StoreAssignmentHistory> {
    const { data } = await api.get<ApiSuccess<StoreAssignmentHistory>>(`/stores/${id}/assignment-history`);
    return data.data;
  },
};
