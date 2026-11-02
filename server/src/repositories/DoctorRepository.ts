import type { Doctor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { StockTxnRepository } from './StockTxnRepository';
import { doctorDuplicateKey } from '../utils/doctorDuplicate';

/** JL-2 before JL-10 (numeric-aware); MSL Nos are unique, so that settles it. */
function compareByMslNo(a: { mslNo: string }, b: { mslNo: string }): number {
  return a.mslNo.localeCompare(b.mslNo, 'en', { numeric: true, sensitivity: 'base' });
}

export interface DoctorListParams {
  page: number;
  limit: number;
  search?: string;
  mrId?: number;
  /** Whose starred doctors list first. */
  viewerId?: number;
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

  /** A live doctor with the same name and area (see `doctorDuplicateKey`), other than `exceptId`. */
  public async findDuplicate(fullName: string, area: string | null | undefined, exceptId?: number) {
    const key = doctorDuplicateKey(fullName, area);
    const candidates = await this.prisma.doctor.findMany({
      where: { deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, fullName: true, area: true },
    });
    return candidates.find((doctor) => doctorDuplicateKey(doctor.fullName, doctor.area) === key) ?? null;
  }

  public getPrisma() {
    return this.prisma;
  }

  /** Ids of the doctors `userId` has starred. */
  public async favoriteDoctorIds(userId: number): Promise<Set<number>> {
    const rows = await this.prisma.doctorFavorite.findMany({
      where: { userId },
      select: { doctorId: true },
    });
    return new Set(rows.map((row) => row.doctorId));
  }

  public async isFavorite(userId: number, doctorId: number): Promise<boolean> {
    const row = await this.prisma.doctorFavorite.findUnique({
      where: { userId_doctorId: { userId, doctorId } },
      select: { id: true },
    });
    return row !== null;
  }

  public async setFavorite(userId: number, doctorId: number, favorite: boolean): Promise<void> {
    if (favorite) {
      await this.prisma.doctorFavorite.createMany({ data: [{ userId, doctorId }], skipDuplicates: true });
    } else {
      await this.prisma.doctorFavorite.deleteMany({ where: { userId, doctorId } });
    }
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

  public async list(
    params: DoctorListParams,
  ): Promise<{ items: Doctor[]; total: number; favoriteIds: Set<number> }> {
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
              { mslNo: { contains: params.search, mode: 'insensitive' } },
              { specialization: { contains: params.search, mode: 'insensitive' } },
              { area: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
    };

    // The viewer's starred doctors first, then MSL No ascending the way the
    // sheet reads ("M2" before "M10", "9" before "10"), which Postgres text
    // order cannot do — so order the light keys here, then load only the page.
    const [keys, favoriteIds] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        select: { id: true, mslNo: true, fullName: true },
      }),
      params.viewerId ? this.favoriteDoctorIds(params.viewerId) : Promise.resolve(new Set<number>()),
    ]);
    keys.sort(
      (a, b) =>
        Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || compareByMslNo(a, b),
    );
    const pageIds = keys
      .slice((params.page - 1) * params.limit, params.page * params.limit)
      .map((key) => key.id);

    const rows = await this.prisma.doctor.findMany({
      where: { id: { in: pageIds } },
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
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds.flatMap((id) => byId.get(id) ?? []);

    return { items, total: keys.length, favoriteIds };
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

  /** Same as `assignMr` for many doctors, in three statements whatever the count. */
  public async assignMrToMany(doctorIds: number[], mrId: number, actorId: number): Promise<void> {
    if (doctorIds.length === 0) return;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.doctorAssignment.updateMany({
        where: { doctorId: { in: doctorIds }, isActive: true, deletedAt: null },
        data: { isActive: false, unassignedAt: now, updatedBy: actorId },
      }),
      this.prisma.doctorAssignment.createMany({
        data: doctorIds.map((doctorId) => ({
          doctorId,
          mrId,
          isActive: true,
          createdBy: actorId,
          updatedBy: actorId,
        })),
        skipDuplicates: true,
      }),
      // Pairs from an earlier, ended assignment were skipped above; bring them back.
      this.prisma.doctorAssignment.updateMany({
        where: { doctorId: { in: doctorIds }, mrId },
        data: { isActive: true, unassignedAt: null, assignedAt: now, deletedAt: null, updatedBy: actorId },
      }),
    ]);
  }

  /** Takes the doctors off whichever MR they are with. */
  public async unassignMany(doctorIds: number[], actorId: number): Promise<void> {
    if (doctorIds.length === 0) return;
    await this.prisma.doctorAssignment.updateMany({
      where: { doctorId: { in: doctorIds }, isActive: true, deletedAt: null },
      data: { isActive: false, unassignedAt: new Date(), updatedBy: actorId },
    });
  }

  /** The ids in `ids` that are live doctors. */
  public async existingIds(ids: number[]): Promise<number[]> {
    const rows = await this.prisma.doctor.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return rows.map((row) => row.id);
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
