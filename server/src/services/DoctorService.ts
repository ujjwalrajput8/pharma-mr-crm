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
    mr: { id: string; fullName: string; email: string };
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

  public async getById(id: string, actor: AuthUser) {
    await this.requireAccessible(id, actor);
    const doctor = await this.doctors.findByIdWithAssignments(id);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }
    return this.toPublic(doctor as DoctorWithAssignments);
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

  public async update(id: string, dto: UpdateDoctorDto, actor: AuthUser) {
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

  public async remove(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.requireAccessible(id, actor);
    await this.doctors.softDelete(id, actor.id);
  }

  public async assignMr(id: string, dto: AssignMrDto, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.requireAccessible(id, actor);

    const mr = await this.users.findById(dto.mrId);
    if (!mr || mr.role !== AppRoles.MR) {
      throw new NotFoundError('Medical Representative not found');
    }

    await this.doctors.assignMr(id, dto.mrId, actor.id);
    return this.getById(id, actor);
  }

  private async requireAccessible(id: string, actor: AuthUser): Promise<Doctor> {
    const doctor = await this.doctors.findById(id);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    if (actor.role === AppRoles.ADMIN) {
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
