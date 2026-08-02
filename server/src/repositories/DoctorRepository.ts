import type { Doctor, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export interface DoctorListParams {
  page: number;
  limit: number;
  search?: string;
  mrId?: string;
}

/**
 * DoctorRepository — Prisma data access for doctors and assignments.
 */
export class DoctorRepository {
  private static instance: DoctorRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): DoctorRepository {
    if (!DoctorRepository.instance) {
      DoctorRepository.instance = new DoctorRepository();
    }
    return DoctorRepository.instance;
  }

  public create(data: Prisma.DoctorCreateInput): Promise<Doctor> {
    return this.prisma.doctor.create({ data });
  }

  public update(id: string, data: Prisma.DoctorUpdateInput): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data });
  }

  public findById(id: string): Promise<Doctor | null> {
    return this.prisma.doctor.findFirst({ where: { id, deletedAt: null } });
  }

  public findByIdWithAssignments(id: string) {
    return this.prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: {
          where: { isActive: true, deletedAt: null },
          include: {
            mr: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });
  }

  public async softDelete(id: string, updatedBy?: string): Promise<Doctor> {
    return this.prisma.doctor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      },
    });
  }

  public async list(params: DoctorListParams): Promise<{ items: Doctor[]; total: number }> {
    const where: Prisma.DoctorWhereInput = {
      deletedAt: null,
      ...(params.mrId
        ? {
            assignments: {
              some: {
                mrId: params.mrId,
                isActive: true,
                deletedAt: null,
              },
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { specialization: { contains: params.search, mode: 'insensitive' } },
              { hospital: { contains: params.search, mode: 'insensitive' } },
              { clinic: { contains: params.search, mode: 'insensitive' } },
              { city: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          assignments: {
            where: { isActive: true, deletedAt: null },
            include: {
              mr: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.doctor.count({ where }),
    ]);

    return { items, total };
  }

  public async assignMr(doctorId: string, mrId: string, actorId: string): Promise<void> {
    await this.prisma.doctorAssignment.updateMany({
      where: { doctorId, isActive: true, deletedAt: null },
      data: { isActive: false, unassignedAt: new Date(), updatedBy: actorId },
    });

    await this.prisma.doctorAssignment.upsert({
      where: { doctorId_mrId: { doctorId, mrId } },
      create: {
        doctorId,
        mrId,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        isActive: true,
        unassignedAt: null,
        assignedAt: new Date(),
        deletedAt: null,
        updatedBy: actorId,
      },
    });
  }
}
