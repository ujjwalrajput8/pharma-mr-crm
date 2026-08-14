import type { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { StockTxnRepository } from './StockTxnRepository';

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

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
  ) {}

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
    const [appointments, visits, sampleTxns, visitProductGroups] = await Promise.all([
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
        },
      }),
      this.stockTxns.findSamplesForDoctor(doctorId),
      this.prisma.visitProduct.groupBy({
        by: ['medicineId'],
        where: {
          deletedAt: null,
          visit: { doctorId, deletedAt: null },
        },
        _count: { medicineId: true },
      }),
    ]);

    const visitIds = sampleTxns
      .map((row) => row.refId)
      .filter((id): id is number => id != null);
    const mrIds = sampleTxns
      .map((row) => row.fromHolderId)
      .filter((id): id is number => id != null);

    const [visitsById, mrs] = await Promise.all([
      visitIds.length
        ? this.prisma.visit.findMany({
            where: { id: { in: visitIds } },
            select: { id: true, visitDate: true },
          })
        : Promise.resolve([]),
      mrIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
    ]);

    const visitMap = new Map(visitsById.map((v) => [v.id, v]));
    const mrMap = new Map(mrs.map((m) => [m.id, m]));

    const distributions = sampleTxns.map((row) => ({
      id: row.id,
      medicineId: row.medicineId,
      medicine: row.medicine,
      quantity: row.qty,
      batchNumber: row.batch.batchNo,
      remarks: row.note,
      distributedAt: row.createdAt,
      visitId: row.refId,
      visit: row.refId ? (visitMap.get(row.refId) ?? null) : null,
      mr: row.fromHolderId ? (mrMap.get(row.fromHolderId) ?? null) : null,
    }));

    const visitSamples = await this.stockTxns.findSamplesByVisitIds(visits.map((v) => v.id));
    const samplesByVisit = new Map<number, typeof visitSamples>();
    for (const sample of visitSamples) {
      if (sample.refId == null) continue;
      const list = samplesByVisit.get(sample.refId) ?? [];
      list.push(sample);
      samplesByVisit.set(sample.refId, list);
    }

    const visitsWithSamples = visits.map((visit) => ({
      ...visit,
      distributions: (samplesByVisit.get(visit.id) ?? []).map((row) => ({
        id: row.id,
        medicine: row.medicine,
        quantity: row.qty,
        batchNumber: row.batch.batchNo,
      })),
    }));

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

    return { appointments, visits: visitsWithSamples, distributions, medicinesDiscussed };
  }
}
