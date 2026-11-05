import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

/** HQ, ex-HQ or out-station — the "HQ/EX" half of a doctor's MSL area. */
export type DoctorAreaType = 'HQ' | 'EX' | 'OS';

export const DOCTOR_AREA_TYPE_LABEL: Record<DoctorAreaType, string> = {
  HQ: 'HQ',
  EX: 'EX-HQ',
  OS: 'Out-station',
};

/** Fields follow the company MSL sheet, in the sheet's order. */
export interface Doctor {
  id: number;
  /** Starred by the signed-in user — each user has their own. */
  isFavorite: boolean;
  /** Assigned by the system: JL-001, JL-002 … */
  mslNo: string;
  area: string | null;
  areaType: DoctorAreaType | null;
  fullName: string;
  phone: string | null;
  mslClass: string | null;
  specialization: string | null;
  address: string | null;
  email: string | null;
  /** `YYYY-MM-DD` */
  birthday: string | null;
  /** `YYYY-MM-DD` */
  anniversary: string | null;
  status: string;
  assignedMrs: Array<{ id: number; fullName: string; email: string }>;
}

/** Optional fields: `null` clears on update, omitted leaves them unchanged. */
export interface CreateDoctorPayload {
  area?: string | null;
  areaType?: DoctorAreaType | null;
  fullName: string;
  phone?: string | null;
  mslClass?: string | null;
  specialization?: string | null;
  address?: string | null;
  email?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  mrId?: number;
}

/** "Boring Road · HQ" */
export function formatDoctorArea(doctor: Pick<Doctor, 'area' | 'areaType'>): string | null {
  return [doctor.area, doctor.areaType].filter(Boolean).join(' · ') || null;
}

export interface DoctorImportSummary {
  total: number;
  added: number;
  /** Same name + area as a doctor already on the list, or as an earlier row. */
  duplicates: number;
  /** Rows without a usable doctor's name. */
  invalid: number;
}

export interface DoctorImportPayload {
  fileName?: string;
  rows: Array<{ rowNumber: number; values: Record<string, string | number> }>;
}

export interface DoctorDetails {
  profile: Doctor;
  stats: {
    totalAppointments: number;
    totalVisits: number;
    totalMedicinesDiscussed: number;
    totalSamplesReceived: number;
    lastVisitDate: string | null;
    nextFollowUp: string | null;
  };
  timeline: Array<{
    id: number;
    type: 'APPOINTMENT' | 'VISIT' | 'SAMPLE';
    at: string;
    title: string;
    summary: string;
    meta: Record<string, unknown>;
  }>;
  appointments: Array<{
    id: number;
    date: string;
    time: string;
    purpose: string | null;
    status: string;
    remarks: string | null;
    mr: { id: number; fullName: string; email: string };
  }>;
  visits: Array<{
    id: number;
    /** Null for a visit logged without an appointment. */
    appointmentId: number | null;
    visitDate: string;
    visitTime: string | null;
    meetingDurationMin: number | null;
    discussionNotes: string | null;
    doctorFeedback: string | null;
    remarks: string | null;
    nextFollowUp: string | null;
    mr: { id: number; fullName: string; email: string };
    appointment: {
      id: number;
      date: string;
      time: string;
      purpose: string | null;
      status: string;
    } | null;
    products: Array<{ id: number; name: string; company: string | null; notes: string | null }>;
    samples: Array<{
      id: number;
      medicineId: number;
      medicineName: string;
      quantity: number;
      batchNumber: string | null;
    }>;
  }>;
  medicines: Array<{
    medicineId: number;
    name: string;
    company: string | null;
    category: string | null;
    timesDiscussed: number;
  }>;
  samples: Array<{
    id: number;
    medicineId: number;
    medicineName: string;
    company: string | null;
    quantity: number;
    batchNumber: string | null;
    remarks: string | null;
    distributedAt: string;
    visitId: number;
    visitDate: string;
    mr: { id: number; fullName: string };
  }>;
  report: {
    appointmentsByStatus: Record<string, number>;
    visitsCount: number;
    medicinesDiscussedCount: number;
    samplesQuantity: number;
    sampleLines: number;
  };
}

/** One MR in the assignment picker. */
export interface MrOption {
  id: number;
  fullName: string;
  employeeCode: string | null;
  photoUrl: string | null;
  area: string | null;
  /** Reporting line above the MR, e.g. "Amit Kumar (Area Sales Manager) → Vikram Singh". */
  team: string;
  doctorCount: number;
}

/** What the server reports when a doctor would change MR (409 CONFIRM_MOVE). */
export interface AssignmentMove {
  doctorId: number;
  doctorName: string;
  from: { id: number; fullName: string; employeeCode: string | null; team: string };
  to: { id: number; fullName: string; employeeCode: string | null; team: string } | null;
  pendingAppointments: number;
  planCalls: number;
  visits: number;
}

export interface AssignmentHistory {
  assignments: Array<{ mrId: number; mrName: string; active: boolean; from: string; to: string | null }>;
  changes: Array<{
    action: 'DOCTOR_ASSIGNED' | 'DOCTOR_REASSIGNED' | 'DOCTOR_UNASSIGNED';
    at: string;
    by: { id: number; fullName: string } | null;
    before: { mrName?: string | null; team?: string } | null;
    after: { mrName?: string | null; team?: string } | null;
    note: string | null;
    source: string | null;
  }>;
}

export const doctorsApi = {
  async mrOptions(q?: string): Promise<MrOption[]> {
    const { data } = await api.get<ApiSuccess<MrOption[]>>('/doctors/mr-options', { params: q ? { q } : {} });
    return data.data;
  },
  async assignmentHistory(id: number): Promise<AssignmentHistory> {
    const { data } = await api.get<ApiSuccess<AssignmentHistory>>(`/doctors/${id}/assignment-history`);
    return data.data;
  },
  async list(search?: string): Promise<Doctor[]> {
    // Screens filter and page client-side, so fetch the whole list, not the API's first 20.
    const { data } = await api.get<ApiSuccess<Doctor[]>>('/doctors', {
      params: { limit: 5000, ...(search ? { search } : {}) },
    });
    return data.data;
  },

  async getDetails(id: number): Promise<DoctorDetails> {
    const { data } = await api.get<ApiSuccess<DoctorDetails>>(`/doctors/${id}/details`);
    return data.data;
  },

  async create(payload: CreateDoctorPayload): Promise<Doctor> {
    const { data } = await api.post<ApiSuccess<Doctor>>('/doctors', payload);
    return data.data;
  },

  /** `mrId: null` takes the doctor off their MR; leave it out to keep the MR. */
  async update(
    id: number,
    payload: Partial<Omit<CreateDoctorPayload, 'mrId'>> & { mrId?: number | null; confirmMove?: boolean; note?: string },
  ): Promise<Doctor> {
    const { data } = await api.patch<ApiSuccess<Doctor>>(`/doctors/${id}`, payload);
    return data.data;
  },

  async importRows(payload: DoctorImportPayload): Promise<{ summary: DoctorImportSummary }> {
    const { data } = await api.post<ApiSuccess<{ summary: DoctorImportSummary }>>('/doctors/import', payload, {
      // A couple of thousand rows run in one transaction on the server.
      timeout: 180_000,
    });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/doctors/${id}`);
  },

  /** Many doctors to one MR at once; `mrId: null` unassigns them. */
  async assignMr(
    doctorIds: number[],
    mrId: number | null,
    options: { confirmMove?: boolean; note?: string } = {},
  ): Promise<{ doctors: number; mr: { id: number; fullName: string } | null }> {
    const { data } = await api.post<
      ApiSuccess<{ doctors: number; mr: { id: number; fullName: string } | null }>
    >('/doctors/assign-mr', { doctorIds, mrId, ...options });
    return data.data;
  },

  async setFavorite(id: number, favorite: boolean): Promise<void> {
    if (favorite) await api.put(`/doctors/${id}/favorite`);
    else await api.delete(`/doctors/${id}/favorite`);
  },
};
