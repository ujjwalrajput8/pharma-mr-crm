import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type VisitSource = 'APPOINTMENT' | 'DIRECT';
export type VisitPurpose = 'DETAILING' | 'FOLLOW_UP' | 'SAMPLE_DROP' | 'ORDER_POB' | 'RELATIONSHIP' | 'OTHER';
export type InterestLevel = 'LOW' | 'MEDIUM' | 'HIGH';
/** Who the DCR call was on. */
export type VisitParty = 'DOCTOR' | 'CHEMIST' | 'STOCKIST';
export type StorePurpose =
  | 'ORDER_POB'
  | 'STOCK_CHECK'
  | 'PRODUCT_AVAILABILITY'
  | 'PAYMENT'
  | 'STOCK_STATEMENT'
  | 'EXPIRY_RETURNS'
  | 'RELATIONSHIP'
  | 'OTHER';

export const STORE_VISIT_PURPOSES: Array<{ value: StorePurpose; label: string }> = [
  { value: 'ORDER_POB', label: 'Order / POB' },
  { value: 'STOCK_CHECK', label: 'Stock check' },
  { value: 'PRODUCT_AVAILABILITY', label: 'Product availability' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'STOCK_STATEMENT', label: 'Stock statement' },
  { value: 'EXPIRY_RETURNS', label: 'Expiry / returns' },
  { value: 'RELATIONSHIP', label: 'Relationship' },
  { value: 'OTHER', label: 'Other' },
];
export const PARTY_LABEL: Record<VisitParty, string> = { DOCTOR: 'Doctor', CHEMIST: 'Chemist', STOCKIST: 'Stockist' };

export const VISIT_PURPOSES: Array<{ value: VisitPurpose; label: string }> = [
  { value: 'DETAILING', label: 'Detailing' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'SAMPLE_DROP', label: 'Sample drop' },
  { value: 'ORDER_POB', label: 'Order / POB' },
  { value: 'RELATIONSHIP', label: 'Relationship' },
  { value: 'OTHER', label: 'Other' },
];

export interface VisitDoctor {
  id: number;
  fullName: string;
  mslNo: string;
  mslClass: string | null;
  specialization: string | null;
  area: string | null;
  address: string | null;
}

export interface VisitSampleLine {
  medicineId: number;
  medicineName: string;
  batchId: number;
  batchNumber: string;
  expiryDate: string | null;
  /** Net: given − returned − written off. */
  quantity: number;
  given: number;
  returned: number;
  writtenOff: number;
  remarks: string | null;
}

export interface Visit {
  id: number;
  appointmentId: number | null;
  doctorId: number | null;
  mrId: number;
  source: VisitSource;
  partyType: VisitParty;
  /** Chemist / stockist calls. */
  store: { id: number; name: string; type: 'CHEMIST' | 'STOCKIST'; ownerName: string | null; city: string | null; addressLine1: string | null } | null;
  orderValue: number | null;
  visitDate: string;
  visitTime: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  meetingDurationMin: number | null;
  purpose: VisitPurpose | StorePurpose | null;
  discussionNotes: string | null;
  doctorFeedback: string | null;
  visitOutcome: string | null;
  nextFollowUp: string | null;
  remarks: string | null;
  location: { lat: number; lng: number } | null;
  /** Doctor was not in the MR's list when logged. */
  offList: boolean;
  review: { at: string; by: { id: number; fullName: string } | null; action: string | null; note: string | null } | null;
  lastCorrectedAt: string | null;
  doctor: VisitDoctor | null;
  mr: { id: number; fullName: string; email: string; photoUrl: string | null } | null;
  appointment: { id: number; date: string; time: string | null; purpose: string | null; status: string } | null;
  products: Array<{ id: number; name: string; interestLevel: string | null; prescriptionExpected: boolean; notes: string | null }>;
  distributions: VisitSampleLine[];
  can: { correct: boolean; changeDateOrDoctor: boolean; correctSamples: boolean; review: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface VisitListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: {
    all: number;
    direct: number;
    fromAppointment: number;
    unlistedPending: number;
    doctor: number;
    chemist: number;
    stockist: number;
  };
}

export interface VisitListParams {
  page?: number;
  limit?: number;
  mrId?: number;
  doctorId?: number;
  from?: string;
  to?: string;
  source?: VisitSource;
  partyType?: VisitParty;
  offList?: boolean;
  reviewed?: boolean;
  corrected?: boolean;
  search?: string;
}

export interface VisitProductInput {
  medicineId: number;
  interestLevel?: InterestLevel;
  prescriptionExpected?: boolean;
  notes?: string;
}

export interface VisitSampleInput {
  medicineId: number;
  quantity: number;
  batchId?: number;
  remarks?: string;
}

export interface LogVisitPayload {
  doctorId: number;
  mrId?: number;
  visitDate: string;
  visitTime: string;
  checkInTime?: string;
  checkOutTime?: string;
  purpose?: VisitPurpose;
  discussionNotes?: string;
  doctorFeedback?: string;
  visitOutcome?: string;
  nextFollowUp?: string;
  remarks?: string;
  products?: VisitProductInput[];
  samples?: VisitSampleInput[];
  latitude?: number;
  longitude?: number;
  clientUuid?: string;
}

export interface StoreCallPayload {
  storeId: number;
  mrId?: number;
  visitDate: string;
  visitTime: string;
  purpose?: StorePurpose;
  discussionNotes?: string;
  remarks?: string;
  orderValue?: number;
  products?: VisitProductInput[];
  latitude?: number;
  longitude?: number;
  clientUuid?: string;
}

export interface BulkVisitRow {
  doctorId: number;
  doctorName: string | null;
  mslNo: string | null;
  area: string | null;
  status: 'READY' | 'ALREADY_VISITED' | 'UNLISTED' | 'INVALID' | 'CREATED' | 'FAILED';
  reason: string | null;
  visitId: number | null;
}

export interface BulkVisitResult {
  dryRun: boolean;
  bulkRunId?: string;
  mr: { id: number; fullName: string };
  rows: BulkVisitRow[];
  summary: { total: number; ready: number; created: number; skipped: number; failed: number };
}

export interface VisitHistoryEntry {
  id: number;
  action: string;
  at: string;
  by: { id: number; fullName: string } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

export interface DoctorLookup extends VisitDoctor {
  assignedMr: { id: number; fullName: string } | null;
}

export type CorrectVisitPayload = Partial<{
  visitDate: string;
  doctorId: number;
  visitTime: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  purpose: VisitPurpose | StorePurpose | null;
  discussionNotes: string | null;
  doctorFeedback: string | null;
  visitOutcome: string | null;
  nextFollowUp: string | null;
  remarks: string | null;
  orderValue: number | null;
  products: VisitProductInput[];
}> & { reason: string };

export interface SampleCorrectionLine {
  action: 'RETURN_TO_BAG' | 'WRITE_OFF' | 'ADD_GIVEN';
  medicineId: number;
  batchId?: number;
  quantity: number;
}

export const visitsApi = {
  async list(params: VisitListParams = {}): Promise<{ items: Visit[]; meta: VisitListMeta }> {
    const { data } = await api.get<ApiSuccess<Visit[]> & { meta: VisitListMeta }>('/visits', {
      params: { limit: 20, ...params },
    });
    return { items: data.data, meta: data.meta as VisitListMeta };
  },
  async get(id: number): Promise<Visit> {
    const { data } = await api.get<ApiSuccess<Visit>>(`/visits/${id}`);
    return data.data;
  },
  async history(id: number): Promise<VisitHistoryEntry[]> {
    const { data } = await api.get<ApiSuccess<VisitHistoryEntry[]>>(`/visits/${id}/history`);
    return data.data;
  },
  async create(payload: LogVisitPayload): Promise<Visit & { replayed: boolean }> {
    const { data } = await api.post<ApiSuccess<Visit & { replayed: boolean }>>('/visits', payload);
    return data.data;
  },
  async storeCall(payload: StoreCallPayload): Promise<Visit & { replayed: boolean }> {
    const { data } = await api.post<ApiSuccess<Visit & { replayed: boolean }>>('/visits/store-call', payload);
    return data.data;
  },
  async bulk(payload: {
    doctorIds: number[];
    mrId?: number;
    visitDate: string;
    visitTime: string;
    purpose?: VisitPurpose;
    discussionNotes?: string;
    remarks?: string;
    products?: VisitProductInput[];
    dryRun: boolean;
  }): Promise<BulkVisitResult> {
    const { data } = await api.post<ApiSuccess<BulkVisitResult>>('/visits/bulk', payload);
    return data.data;
  },
  async correct(id: number, payload: CorrectVisitPayload): Promise<Visit> {
    const { data } = await api.patch<ApiSuccess<Visit>>(`/visits/${id}`, payload);
    return data.data;
  },
  async correctSamples(id: number, payload: { reason: string; lines: SampleCorrectionLine[] }): Promise<Visit> {
    const { data } = await api.post<ApiSuccess<Visit>>(`/visits/${id}/sample-correction`, payload);
    return data.data;
  },
  async review(id: number, payload: { action: 'ASSIGN' | 'REVIEWED'; note?: string; confirmMove?: boolean }): Promise<Visit> {
    const { data } = await api.post<ApiSuccess<Visit>>(`/visits/${id}/review`, payload);
    return data.data;
  },
  async lookupDoctors(q: string): Promise<DoctorLookup[]> {
    const { data } = await api.get<ApiSuccess<DoctorLookup[]>>('/doctors/lookup', { params: { q } });
    return data.data;
  },
};

export function purposeLabel(value: string | null | undefined): string {
  return (
    VISIT_PURPOSES.find((p) => p.value === value)?.label ??
    STORE_VISIT_PURPOSES.find((p) => p.value === value)?.label ??
    (value ? value : '—')
  );
}

/** Doctor, chemist or stockist name — whoever the call was on. */
export function partyName(visit: Pick<Visit, 'doctor' | 'store'>): string {
  return visit.doctor?.fullName ?? visit.store?.name ?? '—';
}
