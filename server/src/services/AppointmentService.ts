import { AppRoles, AppointmentStatuses } from '../constants';
import type {
  CompleteAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import {
  AppointmentRepository,
  type AppointmentWithRelations,
} from '../repositories/AppointmentRepository';
import { DoctorRepository } from '../repositories/DoctorRepository';
import { StockTxnRepository } from '../repositories/StockTxnRepository';
import { UserRepository } from '../repositories/UserRepository';
import { PrismaService } from '../prisma/PrismaService';
import { StockLedgerService } from './StockLedgerService';
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
 * AppointmentService — role-scoped scheduling.
 * MR: own only · Manager: team + self · Admin: all (can assign to any MR).
 */
export class AppointmentService {
  private static instance: AppointmentService | null = null;

  private constructor(
    private readonly appointments = AppointmentRepository.getInstance(),
    private readonly doctors = DoctorRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
    private readonly prisma = PrismaService.getClient(),
  ) {}

  public static getInstance(): AppointmentService {
    if (!AppointmentService.instance) {
      AppointmentService.instance = new AppointmentService();
    }
    return AppointmentService.instance;
  }

  public async listAssignableMrs(actor: AuthUser) {
    if (actor.role === AppRoles.MR) {
      return [
        {
          id: actor.id,
          fullName: actor.fullName,
          email: actor.email,
          role: actor.role,
        },
      ];
    }

    if (actor.role === AppRoles.MANAGER) {
      const reportIds = await this.users.listReportIds(actor.id);
      const team = await this.users.findManyByIds(reportIds);
      const mrs = team.filter((u) => u.role === AppRoles.MR);
      return [
        { id: actor.id, fullName: actor.fullName, email: actor.email, role: actor.role },
        ...mrs.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
        })),
      ];
    }

    const { items } = await this.users.list({ page: 1, limit: 100, role: AppRoles.MR });
    return items.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
    }));
  }

  public async list(query: ListAppointmentsQueryDto, actor: AuthUser) {
    const scope = await this.resolveListScope(actor, query.mrId);

    const { items, total } = await this.appointments.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      doctorId: query.doctorId,
      ...scope,
    });

    const publics = await this.toPublicMany(items);

    return {
      items: publics,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async create(dto: CreateAppointmentDto, actor: AuthUser) {
    const mrId = await this.resolveTargetMrId(dto.mrId, actor);
    await this.ensureDoctorAccess(dto.doctorId, actor, mrId);

    const isSelfBooking = mrId === actor.id;
    const assignedById = isSelfBooking ? null : actor.id;

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
      ...(assignedById
        ? { assignedBy: { connect: { id: assignedById } } }
        : {}),
    });

    return this.toPublicOne(appointment);
  }

  public async update(id: number, dto: UpdateAppointmentDto, actor: AuthUser) {
    const existing = await this.requireAccessible(id, actor);

    if (existing.status === AppointmentStatuses.COMPLETED) {
      throw new BadRequestError('Completed appointments cannot be edited');
    }
    if (existing.status === AppointmentStatuses.CANCELLED) {
      throw new BadRequestError('Cancelled appointments cannot be rescheduled — create a new one');
    }

    if (dto.status === AppointmentStatuses.COMPLETED) {
      throw new BadRequestError('Use complete endpoint to finish an appointment and create a visit');
    }

    let nextMrId: number | undefined;
    if (dto.mrId != null && actor.role !== AppRoles.MR) {
      nextMrId = await this.resolveTargetMrId(dto.mrId, actor);
    }

    if (dto.doctorId) {
      await this.ensureDoctorAccess(dto.doctorId, actor, nextMrId ?? existing.mrId);
    }

    const dateOrTimeChanged = Boolean(dto.date || dto.time);
    const nextStatus =
      dto.status ??
      (dateOrTimeChanged &&
      (existing.status === AppointmentStatuses.PENDING ||
        existing.status === AppointmentStatuses.RESCHEDULED)
        ? AppointmentStatuses.RESCHEDULED
        : undefined);

    const appointment = await this.appointments.update(id, {
      ...(dto.date ? { date: parseDateOnly(dto.date) } : {}),
      ...(dto.time ? { time: parseTime(dto.time) } : {}),
      ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(dto.doctorId ? { doctor: { connect: { id: dto.doctorId } } } : {}),
      ...(nextMrId
        ? {
            mr: { connect: { id: nextMrId } },
            assignedBy:
              nextMrId === actor.id
                ? { disconnect: true }
                : { connect: { id: actor.id } },
          }
        : {}),
      updatedBy: actor.id,
    });

    return this.toPublicOne(appointment);
  }

  /** Convenience: change date/time → status RESCHEDULED */
  public async reschedule(
    id: number,
    input: { date: string; time: string; remarks?: string },
    actor: AuthUser,
  ) {
    return this.update(
      id,
      {
        date: input.date,
        time: input.time,
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        status: AppointmentStatuses.RESCHEDULED,
      },
      actor,
    );
  }

  public async completeWithVisit(id: number, dto: CompleteAppointmentDto, actor: AuthUser) {
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

    const resolvedDistributions: Array<{
      medicineId: number;
      quantity: number;
      batchNumber?: string;
      remarks?: string;
      batchId: number;
      batchNo: string;
    }> = [];
    for (const distribution of dto.distributions) {
      const batch = await this.stockTxns.resolveBatchForMrSample({
        mrId: appointment.mrId,
        medicineId: distribution.medicineId,
        batchNumber: distribution.batchNumber,
        requiredQty: distribution.quantity,
      });
      if (!batch) {
        throw new BadRequestError(
          `Insufficient MR stock for medicine ${distribution.medicineId}. Admin must issue samples first.`,
        );
      }
      resolvedDistributions.push({ ...distribution, batchId: batch.batchId, batchNo: batch.batchNo });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatuses.COMPLETED,
          updatedBy: actor.id,
        },
        include: {
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
          assignedBy: { select: { id: true, fullName: true, email: true, role: true } },
        },
      });

      const productRows =
        dto.products && dto.products.length > 0
          ? dto.products
          : dto.medicineIds.map((medicineId) => ({ medicineId, notes: undefined as string | undefined }));

      const visit = await tx.visit.create({
        data: {
          appointmentId: id,
          doctorId: appointment.doctorId,
          mrId: appointment.mrId,
          visitDate: parseDateOnly(dto.visitDate),
          visitTime: parseTime(dto.visitTime),
          checkInTime: dto.checkInTime ? parseTime(dto.checkInTime) : parseTime(dto.visitTime),
          checkOutTime: dto.checkOutTime ? parseTime(dto.checkOutTime) : null,
          meetingDurationMin: dto.meetingDurationMin,
          discussionNotes: dto.discussionNotes,
          doctorFeedback: dto.doctorFeedback,
          visitOutcome: dto.visitOutcome,
          nextFollowUp: dto.nextFollowUp ? parseDateOnly(dto.nextFollowUp) : null,
          remarks: dto.remarks,
          createdBy: actor.id,
          updatedBy: actor.id,
          products: {
            create: productRows.map((product) => ({
              medicineId: product.medicineId,
              notes: product.notes,
              createdBy: actor.id,
              updatedBy: actor.id,
            })),
          },
        },
        include: {
          products: { include: { medicine: { select: { id: true, name: true } } } },
        },
      });

      const sampleTxns = [];
      for (const distribution of resolvedDistributions) {
        const txn = await this.ledger.giveSample({
          mrId: appointment.mrId,
          doctorId: appointment.doctorId,
          medicineId: distribution.medicineId,
          batchId: distribution.batchId,
          qty: distribution.quantity,
          visitId: visit.id,
          txnDate: parseDateOnly(dto.visitDate),
          note: distribution.remarks,
          createdBy: actor.id,
          client: tx,
        });
        sampleTxns.push({
          id: txn.id,
          medicineId: distribution.medicineId,
          quantity: distribution.quantity,
          batchNumber: distribution.batchNo,
          remarks: distribution.remarks,
        });
      }

      const fullVisit = await tx.visit.findUniqueOrThrow({
        where: { id: visit.id },
        include: {
          products: { include: { medicine: { select: { id: true, name: true } } } },
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      });

      return { appointment: updatedAppointment, visit: fullVisit, sampleTxns };
    });

    const medicineIds = [...new Set(result.sampleTxns.map((row) => row.medicineId))];
    const medicines =
      medicineIds.length === 0
        ? []
        : await this.prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, name: true },
          });
    const medicineMap = new Map(medicines.map((m) => [m.id, m.name]));

    return {
      appointment: await this.toPublicOne(result.appointment),
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
        distributions: result.sampleTxns.map((d) => ({
          id: d.id,
          medicineId: d.medicineId,
          medicineName: medicineMap.get(d.medicineId) ?? 'Unknown',
          quantity: d.quantity,
          batchNumber: d.batchNumber,
          remarks: d.remarks ?? null,
        })),
      },
    };
  }

  public async remove(id: number, actor: AuthUser) {
    await this.requireAccessible(id, actor);
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only administrators can delete appointments');
    }
    await this.appointments.softDelete(id, actor.id);
  }

  private async resolveListScope(
    actor: AuthUser,
    filterMrId?: number,
  ): Promise<{ mrId?: number; mrIds?: number[] }> {
    if (actor.role === AppRoles.MR) {
      return { mrId: actor.id };
    }

    if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      const allowed = [actor.id, ...teamIds];
      if (filterMrId != null) {
        if (!allowed.includes(filterMrId)) {
          throw new ForbiddenError('You can only view appointments for your team');
        }
        return { mrId: filterMrId };
      }
      return { mrIds: allowed };
    }

    // Admin
    if (filterMrId != null) return { mrId: filterMrId };
    return {};
  }

  private async resolveTargetMrId(requestedMrId: number | undefined, actor: AuthUser): Promise<number> {
    if (actor.role === AppRoles.MR) {
      if (requestedMrId != null && requestedMrId !== actor.id) {
        throw new ForbiddenError('You can only create appointments for yourself');
      }
      return actor.id;
    }

    if (actor.role === AppRoles.MANAGER) {
      const mrId = requestedMrId ?? actor.id;
      if (mrId === actor.id) return mrId;
      const teamIds = await this.users.listReportIds(actor.id);
      if (!teamIds.includes(mrId)) {
        throw new ForbiddenError('You can only assign appointments to your team MRs');
      }
      const mr = await this.users.findById(mrId);
      if (!mr || mr.role !== AppRoles.MR) {
        throw new NotFoundError('Medical Representative not found');
      }
      return mrId;
    }

    // Admin
    if (!requestedMrId) throw new BadRequestError('MR is required for appointment');
    const mr = await this.users.findById(requestedMrId);
    if (!mr || mr.role !== AppRoles.MR) {
      throw new NotFoundError('Medical Representative not found');
    }
    return requestedMrId;
  }

  private async ensureDoctorAccess(doctorId: number, actor: AuthUser, targetMrId: number) {
    const doctor = await this.doctors.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');
    if (actor.role === AppRoles.ADMIN || actor.role === AppRoles.MANAGER) return;

    const assigned = await this.doctors.list({ page: 1, limit: 1000, mrId: targetMrId });
    if (!assigned.items.some((item) => item.id === doctorId)) {
      throw new ForbiddenError('Doctor is not assigned to you');
    }
  }

  private async requireAccessible(id: number, actor: AuthUser) {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Appointment not found');

    if (actor.role === AppRoles.MR && appointment.mrId !== actor.id) {
      throw new ForbiddenError('You do not have access to this appointment');
    }

    if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      const allowed = new Set([actor.id, ...teamIds]);
      if (!allowed.has(appointment.mrId)) {
        throw new ForbiddenError('You do not have access to this appointment');
      }
    }

    return appointment;
  }

  private async toPublicMany(items: AppointmentWithRelations[]) {
    const creatorIds = [
      ...new Set(items.map((item) => item.createdBy).filter((id): id is number => id != null)),
    ];
    const creators = await this.users.findManyByIds(creatorIds);
    const creatorMap = new Map(creators.map((u) => [u.id, u]));
    return items.map((item) => this.mapPublic(item, creatorMap));
  }

  private async toPublicOne(
    appointment: AppointmentWithRelations | (AppointmentWithRelations & { createdBy: number | null }),
  ) {
    const creatorIds = appointment.createdBy != null ? [appointment.createdBy] : [];
    const creators = await this.users.findManyByIds(creatorIds);
    const creatorMap = new Map(creators.map((u) => [u.id, u]));
    return this.mapPublic(appointment, creatorMap);
  }

  private mapPublic(
    appointment: {
      id: number;
      doctorId: number;
      mrId: number;
      assignedById?: number | null;
      date: Date;
      time: Date;
      purpose?: string | null;
      status: string;
      remarks: string | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy?: number | null;
      doctor?: { id: number; fullName: string } | null;
      mr?: { id: number; fullName: string; email: string } | null;
      assignedBy?: { id: number; fullName: string; email: string; role: string } | null;
    },
    creatorMap: Map<number, { id: number; fullName: string; email: string; role: string }>,
  ) {
    const createdByUser =
      appointment.createdBy != null ? (creatorMap.get(appointment.createdBy) ?? null) : null;

    return {
      id: appointment.id,
      doctorId: appointment.doctorId,
      mrId: appointment.mrId,
      assignedById: appointment.assignedById ?? null,
      date: appointment.date.toISOString().slice(0, 10),
      time: formatTime(appointment.time),
      purpose: appointment.purpose ?? null,
      status: appointment.status,
      remarks: appointment.remarks,
      doctor: appointment.doctor ?? null,
      mr: appointment.mr ?? null,
      createdBy: createdByUser
        ? {
            id: createdByUser.id,
            fullName: createdByUser.fullName,
            email: createdByUser.email,
            role: createdByUser.role,
          }
        : null,
      assignedBy: appointment.assignedBy
        ? {
            id: appointment.assignedBy.id,
            fullName: appointment.assignedBy.fullName,
            email: appointment.assignedBy.email,
            role: appointment.assignedBy.role,
          }
        : null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }
}
