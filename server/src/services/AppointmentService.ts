import { AppRoles, AppointmentStatuses } from '../constants';
import type {
  CompleteAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { AppointmentRepository } from '../repositories/AppointmentRepository';
import { DoctorRepository } from '../repositories/DoctorRepository';
import { UserRepository } from '../repositories/UserRepository';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseTime(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date('1970-01-01T00:00:00.000Z');
  date.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

function formatTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * AppointmentService
 * Scheduling only until completed. Completing an appointment creates the Visit
 * (and optional sample distributions with stock decrement) in one transaction.
 */
export class AppointmentService {
  private static instance: AppointmentService | null = null;

  private constructor(
    private readonly appointments = AppointmentRepository.getInstance(),
    private readonly doctors = DoctorRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly prisma = PrismaService.getClient(),
  ) {}

  public static getInstance(): AppointmentService {
    if (!AppointmentService.instance) {
      AppointmentService.instance = new AppointmentService();
    }
    return AppointmentService.instance;
  }

  public async list(query: ListAppointmentsQueryDto, actor: AuthUser) {
    const { items, total } = await this.appointments.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      doctorId: query.doctorId,
      mrId: actor.role === AppRoles.MR ? actor.id : undefined,
    });

    return {
      items: items.map((item) => this.toPublic(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async create(dto: CreateAppointmentDto, actor: AuthUser) {
    const mrId = actor.role === AppRoles.MR ? actor.id : dto.mrId;
    if (!mrId) throw new ForbiddenError('MR is required for appointment');

    await this.ensureDoctorAccess(dto.doctorId, actor);

    if (actor.role === AppRoles.ADMIN) {
      const mr = await this.users.findById(mrId);
      if (!mr || mr.role !== AppRoles.MR) {
        throw new NotFoundError('Medical Representative not found');
      }
    }

    const appointment = await this.appointments.create({
      date: parseDateOnly(dto.date),
      time: parseTime(dto.time),
      purpose: dto.purpose,
      remarks: dto.remarks,
      status: AppointmentStatuses.PENDING,
      createdBy: actor.id,
      updatedBy: actor.id,
      doctor: { connect: { id: dto.doctorId } },
      mr: { connect: { id: mrId } },
    });

    return this.toPublic(appointment);
  }

  public async update(id: string, dto: UpdateAppointmentDto, actor: AuthUser) {
    const existing = await this.requireAccessible(id, actor);

    if (existing.status === AppointmentStatuses.COMPLETED) {
      throw new BadRequestError('Completed appointments cannot be edited');
    }

    if (dto.status === AppointmentStatuses.COMPLETED) {
      throw new BadRequestError('Use complete endpoint to finish an appointment and create a visit');
    }

    const appointment = await this.appointments.update(id, {
      ...(dto.date ? { date: parseDateOnly(dto.date) } : {}),
      ...(dto.time ? { time: parseTime(dto.time) } : {}),
      ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.doctorId ? { doctor: { connect: { id: dto.doctorId } } } : {}),
      ...(dto.mrId && actor.role === AppRoles.ADMIN
        ? { mr: { connect: { id: dto.mrId } } }
        : {}),
      updatedBy: actor.id,
    });

    return this.toPublic(appointment);
  }

  /**
   * Mark appointment COMPLETED and create Visit (+ sample distributions).
   * Stock decreases automatically for each distributed sample.
   */
  public async completeWithVisit(id: string, dto: CompleteAppointmentDto, actor: AuthUser) {
    const appointment = await this.requireAccessible(id, actor);

    if (appointment.status === AppointmentStatuses.CANCELLED) {
      throw new BadRequestError('Cancelled appointments cannot be completed');
    }
    if (appointment.status === AppointmentStatuses.COMPLETED) {
      throw new ConflictError('Appointment is already completed');
    }

    const existingVisit = await this.prisma.visit.findFirst({
      where: { appointmentId: id, deletedAt: null },
    });
    if (existingVisit) {
      throw new ConflictError('A visit already exists for this appointment');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const distribution of dto.distributions) {
        const stock = await tx.stock.findUnique({ where: { medicineId: distribution.medicineId } });
        if (!stock || stock.deletedAt) {
          throw new NotFoundError(`Stock not found for medicine ${distribution.medicineId}`);
        }
        if (stock.available < distribution.quantity) {
          throw new BadRequestError(
            `Insufficient stock for medicine ${distribution.medicineId}. Available: ${stock.available}`,
          );
        }
      }

      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatuses.COMPLETED,
          updatedBy: actor.id,
        },
        include: {
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      });

      const visit = await tx.visit.create({
        data: {
          appointmentId: id,
          doctorId: appointment.doctorId,
          mrId: appointment.mrId,
          visitDate: parseDateOnly(dto.visitDate),
          visitTime: parseTime(dto.visitTime),
          meetingDurationMin: dto.meetingDurationMin,
          discussionNotes: dto.discussionNotes,
          doctorFeedback: dto.doctorFeedback,
          nextFollowUp: dto.nextFollowUp ? parseDateOnly(dto.nextFollowUp) : null,
          remarks: dto.remarks,
          createdBy: actor.id,
          updatedBy: actor.id,
          products: {
            create: dto.medicineIds.map((medicineId) => ({
              medicineId,
              createdBy: actor.id,
              updatedBy: actor.id,
            })),
          },
        },
        include: {
          products: { include: { medicine: { select: { id: true, name: true } } } },
          distributions: true,
        },
      });

      for (const distribution of dto.distributions) {
        await tx.medicineDistribution.create({
          data: {
            visitId: visit.id,
            doctorId: appointment.doctorId,
            mrId: appointment.mrId,
            medicineId: distribution.medicineId,
            quantity: distribution.quantity,
            batchNumber: distribution.batchNumber,
            remarks: distribution.remarks,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });

        await tx.stock.update({
          where: { medicineId: distribution.medicineId },
          data: {
            issued: { increment: distribution.quantity },
            available: { decrement: distribution.quantity },
            updatedBy: actor.id,
          },
        });

        await tx.stockMovement.create({
          data: {
            medicineId: distribution.medicineId,
            mrId: appointment.mrId,
            type: 'ISSUE',
            quantity: distribution.quantity,
            remarks: `Sample distribution for visit ${visit.id}`,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });
      }

      const fullVisit = await tx.visit.findUniqueOrThrow({
        where: { id: visit.id },
        include: {
          products: { include: { medicine: { select: { id: true, name: true } } } },
          distributions: {
            include: { medicine: { select: { id: true, name: true } } },
          },
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      });

      return { appointment: updatedAppointment, visit: fullVisit };
    });

    return {
      appointment: this.toPublic(result.appointment),
      visit: {
        id: result.visit.id,
        appointmentId: result.visit.appointmentId,
        doctorId: result.visit.doctorId,
        mrId: result.visit.mrId,
        visitDate: result.visit.visitDate.toISOString().slice(0, 10),
        visitTime: formatTime(result.visit.visitTime),
        meetingDurationMin: result.visit.meetingDurationMin,
        discussionNotes: result.visit.discussionNotes,
        doctorFeedback: result.visit.doctorFeedback,
        nextFollowUp: result.visit.nextFollowUp
          ? result.visit.nextFollowUp.toISOString().slice(0, 10)
          : null,
        remarks: result.visit.remarks,
        doctor: result.visit.doctor,
        mr: result.visit.mr,
        products: result.visit.products.map((p) => p.medicine),
        distributions: result.visit.distributions.map((d) => ({
          id: d.id,
          medicineId: d.medicineId,
          medicineName: d.medicine.name,
          quantity: d.quantity,
          batchNumber: d.batchNumber,
          remarks: d.remarks,
        })),
      },
    };
  }

  public async remove(id: string, actor: AuthUser) {
    await this.requireAccessible(id, actor);
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('Only administrators can delete appointments');
    }
    await this.appointments.softDelete(id, actor.id);
  }

  private async ensureDoctorAccess(doctorId: string, actor: AuthUser) {
    const doctor = await this.doctors.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');
    if (actor.role === AppRoles.ADMIN) return;

    const assigned = await this.doctors.list({ page: 1, limit: 1000, mrId: actor.id });
    if (!assigned.items.some((item) => item.id === doctorId)) {
      throw new ForbiddenError('Doctor is not assigned to you');
    }
  }

  private async requireAccessible(id: string, actor: AuthUser) {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Appointment not found');
    if (actor.role === AppRoles.MR && appointment.mrId !== actor.id) {
      throw new ForbiddenError('You do not have access to this appointment');
    }
    return appointment;
  }

  private toPublic(appointment: {
    id: string;
    doctorId: string;
    mrId: string;
    date: Date;
    time: Date;
    purpose?: string | null;
    status: string;
    remarks: string | null;
    createdAt: Date;
    updatedAt: Date;
    doctor?: { id: string; fullName: string };
    mr?: { id: string; fullName: string; email: string };
  }) {
    return {
      id: appointment.id,
      doctorId: appointment.doctorId,
      mrId: appointment.mrId,
      date: appointment.date.toISOString().slice(0, 10),
      time: formatTime(appointment.time),
      purpose: appointment.purpose ?? null,
      status: appointment.status,
      remarks: appointment.remarks,
      doctor: appointment.doctor ?? null,
      mr: appointment.mr ?? null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }
}
