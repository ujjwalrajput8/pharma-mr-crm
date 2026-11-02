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
  mslNo: string | null;
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
  mslNo?: string | null;
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

export interface DoctorImportRowResult {
  rowNumber: number;
  action: 'create' | 'update' | 'unchanged' | 'error';
  doctorId: number | null;
  doctorName: string | null;
  mslNo: string | null;
  matchedBy: 'mslNo' | 'mobile' | null;
  changes: Array<{ field: string; from: string | null; to: string | null }>;
  /** Cells that were skipped; the rest of the row still imports. */
  warnings: string[];
  errors: string[];
}

export interface DoctorImportResult {
  dryRun: boolean;
  summary: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    error: number;
    warning: number;
  };
  rows: DoctorImportRowResult[];
}

export interface DoctorImportPayload {
  dryRun: boolean;
  fileName?: string;
  /** MR every doctor in the file is assigned to. */
  mrId?: number;
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
    appointmentId: number;
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

export const doctorsApi = {
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

  async update(id: number, payload: Partial<CreateDoctorPayload>): Promise<Doctor> {
    const { data } = await api.patch<ApiSuccess<Doctor>>(`/doctors/${id}`, payload);
    return data.data;
  },

  async importRows(payload: DoctorImportPayload): Promise<DoctorImportResult> {
    const { data } = await api.post<ApiSuccess<DoctorImportResult>>('/doctors/import', payload, {
      // A couple of thousand rows run in one transaction on the server.
      timeout: 180_000,
    });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/doctors/${id}`);
  },
};
