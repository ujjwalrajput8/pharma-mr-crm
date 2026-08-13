import type { Doctor } from '../../generated/prisma/client';
import { AppRoles } from '../constants';
import type {
  AssignMrDto,
  CreateDoctorDto,
  ListDoctorsQueryDto,
  UpdateDoctorDto,
} from '../dto/doctor.dto';
import { ForbiddenError, NotFoundError } from '../errors/AppError';
import { DoctorRepository } from '../repositories/DoctorRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';

type DoctorWithAssignments = Doctor & {
  assignments?: Array<{
    mr: { id: number; fullName: string; email: string };
  }>;
};

/**
 * DoctorService — Admin full access; MR sees assigned doctors only.
 */
export class DoctorService {
  private static instance: DoctorService | null = null;

  private constructor(
    private readonly doctors = DoctorRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
  ) {}

  public static getInstance(): DoctorService {
    if (!DoctorService.instance) {
      DoctorService.instance = new DoctorService();
    }
    return DoctorService.instance;
  }

  public async list(query: ListDoctorsQueryDto, actor: AuthUser) {
    const { items, total } = await this.doctors.list({
      page: query.page,
      limit: query.limit,
      search: query.search,
      mrId: actor.role === AppRoles.MR ? actor.id : undefined,
    });

    return {
      items: items.map((item) => this.toPublic(item as DoctorWithAssignments)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getById(id: number, actor: AuthUser) {
    await this.requireAccessible(id, actor);
    const doctor = await this.doctors.findByIdWithAssignments(id);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }
    return this.toPublic(doctor as DoctorWithAssignments);
  }

  /**
   * Full doctor workspace: profile, KPIs, timeline, and tab datasets.
   */
  public async getDetails(id: number, actor: AuthUser) {
    await this.requireAccessible(id, actor);
    const doctor = await this.doctors.findByIdWithAssignments(id);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const bundle = await this.doctors.getDetailBundle(id);
    const profile = this.toPublic(doctor as DoctorWithAssignments);

    const formatTime = (value: Date): string =>
      `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;

    const appointments = bundle.appointments.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      time: formatTime(item.time),
      purpose: item.purpose,
      status: item.status,
      remarks: item.remarks,
      mr: item.mr,
    }));

    const visits = bundle.visits.map((item) => ({
      id: item.id,
      appointmentId: item.appointmentId,
      visitDate: item.visitDate.toISOString().slice(0, 10),
      visitTime: item.visitTime ? formatTime(item.visitTime) : null,
      meetingDurationMin: item.meetingDurationMin,
      discussionNotes: item.discussionNotes,
      doctorFeedback: item.doctorFeedback,
      remarks: item.remarks,
      nextFollowUp: item.nextFollowUp ? item.nextFollowUp.toISOString().slice(0, 10) : null,
      mr: item.mr,
      appointment: item.appointment
        ? {
            id: item.appointment.id,
            date: item.appointment.date.toISOString().slice(0, 10),
            time: formatTime(item.appointment.time),
            purpose: item.appointment.purpose,
            status: item.appointment.status,
          }
        : null,
      products: item.products.map((p) => ({
        id: p.medicine.id,
        name: p.medicine.name,
        company: p.medicine.company,
        notes: p.notes,
      })),
      samples: item.distributions.map((d) => ({
        id: d.id,
        medicineId: d.medicine.id,
        medicineName: d.medicine.name,
        quantity: d.quantity,
        batchNumber: d.batchNumber,
      })),
    }));

    const samples = bundle.distributions.map((item) => ({
      id: item.id,
      medicineId: item.medicine.id,
      medicineName: item.medicine.name,
      company: item.medicine.company,
      quantity: item.quantity,
      batchNumber: item.batchNumber,
      remarks: item.remarks,
      distributedAt: item.distributedAt.toISOString(),
      visitId: item.visitId,
      visitDate: item.visit?.visitDate.toISOString().slice(0, 10) ?? null,
      mr: item.mr,
    }));

    const lastVisit = visits[0] ?? null;
    const nextFollowUp =
      visits
        .map((v) => v.nextFollowUp)
        .filter((d): d is string => Boolean(d))
        .sort()
        .find((d) => d >= new Date().toISOString().slice(0, 10)) ??
      visits
        .map((v) => v.nextFollowUp)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1) ??
      null;

    const totalSamplesReceived = samples.reduce((sum, row) => sum + row.quantity, 0);

    const timeline = [
      ...appointments.map((item) => ({
        id: `appointment:${item.id}`,
        type: 'APPOINTMENT' as const,
        at: `${item.date}T${item.time}:00.000Z`,
        title: `Appointment · ${item.status}`,
        summary: item.purpose ?? 'Scheduled meeting',
        meta: { appointmentId: item.id, status: item.status, mrName: item.mr.fullName },
      })),
      ...visits.map((item) => ({
        id: `visit:${item.id}`,
        type: 'VISIT' as const,
        at: `${item.visitDate}T${item.visitTime ?? '00:00'}:00.000Z`,
        title: 'Visit completed',
        summary: item.discussionNotes ?? item.doctorFeedback ?? 'Doctor visit logged',
        meta: {
          visitId: item.id,
          mrName: item.mr.fullName,
          products: item.products.length,
          samples: item.samples.reduce((s, row) => s + row.quantity, 0),
        },
      })),
      ...samples.map((item) => ({
        id: `sample:${item.id}`,
        type: 'SAMPLE' as const,
        at: item.distributedAt,
        title: `Sample · ${item.medicineName}`,
        summary: `Qty ${item.quantity}${item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}`,
        meta: { distributionId: item.id, mrName: item.mr?.fullName ?? 'Unknown', quantity: item.quantity },
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    const report = {
      appointmentsByStatus: appointments.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {}),
      visitsCount: visits.length,
      medicinesDiscussedCount: bundle.medicinesDiscussed.length,
      samplesQuantity: totalSamplesReceived,
      sampleLines: samples.length,
    };

    return {
      profile,
      stats: {
        totalAppointments: appointments.length,
        totalVisits: visits.length,
        totalMedicinesDiscussed: bundle.medicinesDiscussed.length,
        totalSamplesReceived,
        lastVisitDate: lastVisit?.visitDate ?? null,
        nextFollowUp,
      },
      timeline,
      appointments,
      visits,
      medicines: bundle.medicinesDiscussed,
      samples,
      report,
    };
  }

  public async create(dto: CreateDoctorDto, actor: AuthUser) {
    this.assertAdmin(actor);

    const { mrId, ...rest } = dto;
    const doctor = await this.doctors.create({
      ...rest,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    if (mrId) {
      await this.doctors.assignMr(doctor.id, mrId, actor.id);
    }

    return this.getById(doctor.id, actor);
  }

  public async update(id: number, dto: UpdateDoctorDto, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.requireAccessible(id, actor);

    const { mrId, ...rest } = dto;
    await this.doctors.update(id, {
      ...rest,
      updatedBy: actor.id,
    });

    if (mrId) {
      await this.doctors.assignMr(id, mrId, actor.id);
    }

    return this.getById(id, actor);
  }

  public async remove(id: number, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.requireAccessible(id, actor);
    await this.doctors.softDelete(id, actor.id);
  }

  public async assignMr(id: number, dto: AssignMrDto, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.requireAccessible(id, actor);

    const mr = await this.users.findById(dto.mrId);
    if (!mr || mr.role !== AppRoles.MR) {
      throw new NotFoundError('Medical Representative not found');
    }

    await this.doctors.assignMr(id, dto.mrId, actor.id);
    return this.getById(id, actor);
  }

  private async requireAccessible(id: number, actor: AuthUser): Promise<Doctor> {
    const doctor = await this.doctors.findById(id);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    if (actor.role === AppRoles.ADMIN || actor.role === AppRoles.MANAGER) {
      return doctor;
    }

    const assigned = await this.doctors.list({
      page: 1,
      limit: 1000,
      mrId: actor.id,
    });

    if (!assigned.items.some((item) => item.id === id)) {
      throw new ForbiddenError('You do not have access to this doctor');
    }

    return doctor;
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only administrators can perform this action');
    }
  }

  private toPublic(doctor: DoctorWithAssignments) {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      hospital: doctor.hospital,
      clinic: doctor.clinic,
      email: doctor.email,
      phone: doctor.phone,
      addressLine1: doctor.addressLine1,
      addressLine2: doctor.addressLine2,
      city: doctor.city,
      state: doctor.state,
      pincode: doctor.pincode,
      visitingDays: doctor.visitingDays,
      preferredTime: doctor.preferredTime,
      notes: doctor.notes,
      status: doctor.status,
      assignedMrs:
        doctor.assignments?.map((assignment) => ({
          id: assignment.mr.id,
          fullName: assignment.mr.fullName,
          email: assignment.mr.email,
        })) ?? [],
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }
}
