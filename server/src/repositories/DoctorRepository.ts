import type { Doctor, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export interface DoctorListParams {
  page: number;
  limit: number;
  search?: string;
  mrId?: number;
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

  public update(id: number, data: Prisma.DoctorUpdateInput): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data });
  }

  public findById(id: number): Promise<Doctor | null> {
    return this.prisma.doctor.findFirst({ where: { id, deletedAt: null } });
  }

  public findByIdWithAssignments(id: number) {
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

  public async softDelete(id: number, updatedBy?: number): Promise<Doctor> {
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

  public async assignMr(doctorId: number, mrId: number, actorId: number): Promise<void> {
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

  /** Aggregated doctor workspace data for detail tabs. */
  public async getDetailBundle(doctorId: number) {
    const [
      appointments,
      visits,
      distributions,
      visitProductGroups,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { doctorId, deletedAt: null },
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        include: {
          mr: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.visit.findMany({
        where: { doctorId, deletedAt: null },
        orderBy: [{ visitDate: 'desc' }, { visitTime: 'desc' }],
        include: {
          mr: { select: { id: true, fullName: true, email: true } },
          appointment: { select: { id: true, date: true, time: true, purpose: true, status: true } },
          products: {
            where: { deletedAt: null },
            include: { medicine: { select: { id: true, name: true, company: true } } },
          },
          distributions: {
            where: { deletedAt: null },
            include: { medicine: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.medicineDistribution.findMany({
        where: { doctorId, deletedAt: null },
        orderBy: { distributedAt: 'desc' },
        include: {
          medicine: { select: { id: true, name: true, company: true } },
          mr: { select: { id: true, fullName: true } },
          visit: { select: { id: true, visitDate: true } },
        },
      }),
      this.prisma.visitProduct.groupBy({
        by: ['medicineId'],
        where: {
          deletedAt: null,
          visit: { doctorId, deletedAt: null },
        },
        _count: { medicineId: true },
      }),
    ]);

    const medicineIds = visitProductGroups.map((row) => row.medicineId);
    const medicines =
      medicineIds.length === 0
        ? []
        : await this.prisma.medicine.findMany({
            where: { id: { in: medicineIds }, deletedAt: null },
            select: { id: true, name: true, company: true, category: true },
          });

    const medicineMap = new Map(medicines.map((m) => [m.id, m]));
    const medicinesDiscussed = visitProductGroups.map((row) => ({
      medicineId: row.medicineId,
      name: medicineMap.get(row.medicineId)?.name ?? 'Unknown',
      company: medicineMap.get(row.medicineId)?.company ?? null,
      category: medicineMap.get(row.medicineId)?.category ?? null,
      timesDiscussed: row._count.medicineId,
    }));

    return { appointments, visits, distributions, medicinesDiscussed };
  }
}
