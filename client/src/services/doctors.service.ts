import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Doctor {
  id: number;
  fullName: string;
  specialization: string | null;
  hospital: string | null;
  clinic: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state?: string | null;
  addressLine1?: string | null;
  visitingDays: string | null;
  preferredTime: string | null;
  notes?: string | null;
  status: string;
  assignedMrs: Array<{ id: number; fullName: string; email: string }>;
}

export interface CreateDoctorPayload {
  fullName: string;
  specialization?: string;
  hospital?: string;
  clinic?: string;
  email?: string;
  phone?: string;
  city?: string;
  visitingDays?: string;
  preferredTime?: string;
  mrId?: number;
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
    const { data } = await api.get<ApiSuccess<Doctor[]>>('/doctors', {
      params: search ? { search, limit: 100 } : { limit: 100 },
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

  async remove(id: number): Promise<void> {
    await api.delete(`/doctors/${id}`);
  },
};
