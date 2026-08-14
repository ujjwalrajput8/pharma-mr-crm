import { randomBytes } from 'crypto';
import type {
  Batch,
  HolderType,
  Prisma,
  StockRefType,
  StockTxn,
  StockTxnType,
} from '@prisma/client';
import { HolderTypes, StockTxnTypes } from '../constants';
import { PrismaService } from '../prisma/PrismaService';

export type StockTxnClient = Prisma.TransactionClient;

export type StockTxnWithRelations = StockTxn & {
  medicine: { id: number; name: string; company?: string | null };
  batch: { id: number; batchNo: string; expiryDate: Date | null };
};

const sampleInclude = {
  medicine: { select: { id: true, name: true, company: true } },
  batch: { select: { id: true, batchNo: true, expiryDate: true } },
} as const;

const issueInclude = {
  medicine: { select: { id: true, name: true } },
  batch: { select: { id: true, batchNo: true, expiryDate: true } },
} as const;

/**
 * StockTxnRepository — append-only ledger and derived balance rows.
 */
export class StockTxnRepository {
  private static instance: StockTxnRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): StockTxnRepository {
    if (!StockTxnRepository.instance) {
      StockTxnRepository.instance = new StockTxnRepository();
    }
    return StockTxnRepository.instance;
  }

  public getPrisma() {
    return this.prisma;
  }

  public generateTxnNo(): string {
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `TXN-${stamp}-${suffix}`;
  }

  public createBatch(
    data: Prisma.BatchUncheckedCreateInput,
    client: StockTxnClient = this.prisma,
  ): Promise<Batch> {
    return client.batch.create({ data });
  }

  public findBatchByMedicineAndNo(
    medicineId: number,
    batchNo: string,
    client: StockTxnClient = this.prisma,
  ): Promise<Batch | null> {
    return client.batch.findFirst({
      where: { medicineId, batchNo, deletedAt: null },
    });
  }

  public findWarehouseBalance(
    params: {
      warehouseId: number;
      medicineId: number;
      batchId: number;
    },
    client: StockTxnClient = this.prisma,
  ) {
    return client.stockBalance.findUnique({
      where: {
        holderType_holderId_medicineId_batchId: {
          holderType: HolderTypes.WAREHOUSE,
          holderId: params.warehouseId,
          medicineId: params.medicineId,
          batchId: params.batchId,
        },
      },
    });
  }

  public findHolderBalance(
    params: {
      holderType: HolderType;
      holderId: number;
      medicineId: number;
      batchId: number;
    },
    client: StockTxnClient = this.prisma,
  ) {
    return client.stockBalance.findUnique({
      where: {
        holderType_holderId_medicineId_batchId: {
          holderType: params.holderType,
          holderId: params.holderId,
          medicineId: params.medicineId,
          batchId: params.batchId,
        },
      },
    });
  }

  public async decrementBalance(
    params: {
      holderType: HolderType;
      holderId: number;
      medicineId: number;
      batchId: number;
      qty: number;
    },
    client: StockTxnClient,
  ): Promise<void> {
    const balance = await this.findHolderBalance(params, client);
    if (!balance || balance.qty < params.qty) {
      throw new Error('INSUFFICIENT_STOCK');
    }
    await client.stockBalance.update({
      where: {
        holderType_holderId_medicineId_batchId: {
          holderType: params.holderType,
          holderId: params.holderId,
          medicineId: params.medicineId,
          batchId: params.batchId,
        },
      },
      data: { qty: { decrement: params.qty } },
    });
  }

  public async incrementBalance(
    params: {
      holderType: HolderType;
      holderId: number;
      medicineId: number;
      batchId: number;
      qty: number;
    },
    client: StockTxnClient,
  ): Promise<void> {
    const balance = await this.findHolderBalance(params, client);
    if (balance) {
      await client.stockBalance.update({
        where: {
          holderType_holderId_medicineId_batchId: {
            holderType: params.holderType,
            holderId: params.holderId,
            medicineId: params.medicineId,
            batchId: params.batchId,
          },
        },
        data: { qty: { increment: params.qty } },
      });
      return;
    }
    await client.stockBalance.create({
      data: {
        holderType: params.holderType,
        holderId: params.holderId,
        medicineId: params.medicineId,
        batchId: params.batchId,
        qty: params.qty,
      },
    });
  }

  public createTxn(
    data: Prisma.StockTxnUncheckedCreateInput,
    client: StockTxnClient,
  ): Promise<StockTxn> {
    return client.stockTxn.create({ data });
  }

  public async listWarehouseBalances(params: {
    warehouseId: number;
    page: number;
    limit: number;
    search?: string;
    lowOnly?: boolean;
    lowThreshold?: number;
  }) {
    const medicineFilter: Prisma.MedicineWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        holderType: HolderTypes.WAREHOUSE,
        holderId: params.warehouseId,
        qty: { gt: 0 },
        medicine: medicineFilter,
      },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            company: true,
            sku: true,
            sampleAvailable: true,
            status: true,
          },
        },
        batch: { select: { id: true, batchNo: true, expiryDate: true } },
      },
      orderBy: [{ medicine: { name: 'asc' } }, { batch: { batchNo: 'asc' } }],
    });

    const grouped = new Map<
      number,
      {
        medicineId: number;
        medicine: (typeof balances)[number]['medicine'];
        available: number;
        batches: Array<{ batchId: number; batchNo: string; expiryDate: Date | null; qty: number }>;
      }
    >();

    for (const row of balances) {
      const existing = grouped.get(row.medicineId);
      const batchRow = {
        batchId: row.batchId,
        batchNo: row.batch.batchNo,
        expiryDate: row.batch.expiryDate,
        qty: row.qty,
      };
      if (existing) {
        existing.available += row.qty;
        existing.batches.push(batchRow);
      } else {
        grouped.set(row.medicineId, {
          medicineId: row.medicineId,
          medicine: row.medicine,
          available: row.qty,
          batches: [batchRow],
        });
      }
    }

    let items = [...grouped.values()];
    const threshold = params.lowThreshold ?? 10;
    if (params.lowOnly) {
      items = items.filter((row) => row.available <= threshold);
    }

    const total = items.length;
    const start = (params.page - 1) * params.limit;
    return { items: items.slice(start, start + params.limit), total };
  }

  public async getWarehouseMedicineStats(warehouseId: number, medicineId: number) {
    const [opening, issued, returned, available] = await Promise.all([
      this.prisma.stockTxn.aggregate({
        where: {
          txnType: StockTxnTypes.OPENING,
          medicineId,
          toHolderType: HolderTypes.WAREHOUSE,
          toHolderId: warehouseId,
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.aggregate({
        where: {
          txnType: StockTxnTypes.ISSUE,
          medicineId,
          fromHolderType: HolderTypes.WAREHOUSE,
          fromHolderId: warehouseId,
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.aggregate({
        where: {
          txnType: StockTxnTypes.RETURN,
          medicineId,
          toHolderType: HolderTypes.WAREHOUSE,
          toHolderId: warehouseId,
        },
        _sum: { qty: true },
      }),
      this.prisma.stockBalance.aggregate({
        where: {
          holderType: HolderTypes.WAREHOUSE,
          holderId: warehouseId,
          medicineId,
        },
        _sum: { qty: true },
      }),
    ]);

    return {
      openingStock: opening._sum.qty ?? 0,
      issued: issued._sum.qty ?? 0,
      returned: returned._sum.qty ?? 0,
      available: available._sum.qty ?? 0,
    };
  }

  public async listUserHoldings(medicineId: number) {
    const rows = await this.prisma.stockBalance.findMany({
      where: {
        holderType: HolderTypes.USER,
        medicineId,
        qty: { gt: 0 },
      },
      include: {
        batch: { select: { batchNo: true } },
      },
      orderBy: { qty: 'desc' },
    });

    const mrIds = [...new Set(rows.map((row) => row.holderId))];
    const mrs =
      mrIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true, email: true },
          });
    const mrMap = new Map(mrs.map((mr) => [mr.id, mr]));

    return rows.map((row) => ({
      mrId: row.holderId,
      fullName: mrMap.get(row.holderId)?.fullName ?? 'Unknown',
      email: mrMap.get(row.holderId)?.email ?? null,
      quantity: row.qty,
      batchNumber: row.batch.batchNo,
      batchId: row.batchId,
    }));
  }

  public async listSampleDistributions(params: {
    page: number;
    limit: number;
    mrId?: number;
    medicineId?: number;
    visitId?: number;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.StockTxnWhereInput = {
      txnType: StockTxnTypes.SAMPLE_GIVEN,
      refType: 'VISIT',
      ...(params.mrId
        ? { fromHolderType: HolderTypes.USER, fromHolderId: params.mrId }
        : {}),
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
      ...(params.visitId ? { refId: params.visitId } : {}),
      ...(params.from || params.to
        ? {
            txnDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockTxn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: sampleInclude,
      }),
      this.prisma.stockTxn.count({ where }),
    ]);

    const visitIds = [...new Set(items.map((row) => row.refId).filter((id): id is number => id != null))];
    const doctorIds = [
      ...new Set(items.map((row) => row.toHolderId).filter((id): id is number => id != null)),
    ];
    const mrIds = [
      ...new Set(items.map((row) => row.fromHolderId).filter((id): id is number => id != null)),
    ];

    const [visits, doctors, mrs] = await Promise.all([
      visitIds.length
        ? this.prisma.visit.findMany({
            where: { id: { in: visitIds } },
            select: { id: true, visitDate: true },
          })
        : Promise.resolve([]),
      doctorIds.length
        ? this.prisma.doctor.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      mrIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const visitMap = new Map(visits.map((v) => [v.id, v]));
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));
    const mrMap = new Map(mrs.map((m) => [m.id, m]));

    return {
      items: items.map((row) => ({
        id: row.id,
        visitId: row.refId,
        medicineId: row.medicineId,
        medicine: row.medicine,
        doctorId: row.toHolderId,
        doctor: row.toHolderId ? (doctorMap.get(row.toHolderId) ?? null) : null,
        mrId: row.fromHolderId,
        mr: row.fromHolderId ? (mrMap.get(row.fromHolderId) ?? null) : null,
        quantity: row.qty,
        batchNumber: row.batch.batchNo,
        remarks: row.note,
        distributedAt: row.createdAt,
        visit: row.refId ? (visitMap.get(row.refId) ?? null) : null,
      })),
      total,
    };
  }

  public async listIssues(params: {
    page: number;
    limit: number;
    mrId?: number;
    medicineId?: number;
  }) {
    const where: Prisma.StockTxnWhereInput = {
      txnType: StockTxnTypes.ISSUE,
      toHolderType: HolderTypes.USER,
      ...(params.mrId ? { toHolderId: params.mrId } : {}),
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockTxn.findMany({
        where,
        orderBy: { txnDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: issueInclude,
      }),
      this.prisma.stockTxn.count({ where }),
    ]);

    const mrIds = [...new Set(items.map((row) => row.toHolderId).filter((id): id is number => id != null))];
    const mrs =
      mrIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true, email: true },
          });
    const mrMap = new Map(mrs.map((m) => [m.id, m]));

    return {
      items: items.map((row) => ({
        id: row.id,
        quantity: row.qty,
        batchNumber: row.batch.batchNo,
        issueDate: row.txnDate,
        remarks: row.note,
        medicine: row.medicine,
        mr: row.toHolderId ? (mrMap.get(row.toHolderId) ?? null) : null,
      })),
      total,
    };
  }

  public async findSamplesByVisitIds(visitIds: number[]) {
    if (visitIds.length === 0) return [];
    return this.prisma.stockTxn.findMany({
      where: {
        txnType: StockTxnTypes.SAMPLE_GIVEN,
        refType: 'VISIT',
        refId: { in: visitIds },
      },
      include: {
        medicine: { select: { id: true, name: true } },
        batch: { select: { batchNo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findSamplesForDoctor(doctorId: number) {
    return this.prisma.stockTxn.findMany({
      where: {
        txnType: StockTxnTypes.SAMPLE_GIVEN,
        toHolderType: HolderTypes.DOCTOR,
        toHolderId: doctorId,
      },
      orderBy: { createdAt: 'desc' },
      include: sampleInclude,
    });
  }

  public async getMedicineSampleBundle(medicineId: number) {
    const distributions = await this.prisma.stockTxn.findMany({
      where: { txnType: StockTxnTypes.SAMPLE_GIVEN, medicineId },
      orderBy: { createdAt: 'desc' },
      include: sampleInclude,
    });

    const visitIds = distributions
      .map((row) => row.refId)
      .filter((id): id is number => id != null);
    const doctorIds = distributions
      .map((row) => row.toHolderId)
      .filter((id): id is number => id != null);
    const mrIds = distributions
      .map((row) => row.fromHolderId)
      .filter((id): id is number => id != null);

    const [visits, doctors, mrs] = await Promise.all([
      visitIds.length
        ? this.prisma.visit.findMany({
            where: { id: { in: visitIds } },
            select: { id: true, visitDate: true },
          })
        : Promise.resolve([]),
      doctorIds.length
        ? this.prisma.doctor.findMany({
            where: { id: { in: doctorIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      mrIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: mrIds } },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const visitMap = new Map(visits.map((v) => [v.id, v]));
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));
    const mrMap = new Map(mrs.map((m) => [m.id, m]));

    const mrTotals = new Map<number, { quantity: number; issues: number }>();
    const doctorTotals = new Map<number, { quantity: number; issues: number }>();

    for (const row of distributions) {
      if (row.fromHolderId != null) {
        const current = mrTotals.get(row.fromHolderId) ?? { quantity: 0, issues: 0 };
        current.quantity += row.qty;
        current.issues += 1;
        mrTotals.set(row.fromHolderId, current);
      }
      if (row.toHolderId != null) {
        const current = doctorTotals.get(row.toHolderId) ?? { quantity: 0, issues: 0 };
        current.quantity += row.qty;
        current.issues += 1;
        doctorTotals.set(row.toHolderId, current);
      }
    }

    return {
      distributions: distributions.map((row) => ({
        id: row.id,
        quantity: row.qty,
        batchNumber: row.batch.batchNo,
        distributedAt: row.createdAt,
        visitId: row.refId,
        visit: row.refId ? (visitMap.get(row.refId) ?? null) : null,
        doctor: row.toHolderId ? (doctorMap.get(row.toHolderId) ?? null) : null,
        mr: row.fromHolderId ? (mrMap.get(row.fromHolderId) ?? null) : null,
      })),
      mrWise: [...mrTotals.entries()].map(([mrId, stats]) => ({
        mrId,
        fullName: mrMap.get(mrId)?.fullName ?? 'Unknown',
        email: mrMap.get(mrId)?.email ?? null,
        quantity: stats.quantity,
        issues: stats.issues,
      })),
      doctorWise: [...doctorTotals.entries()].map(([doctorId, stats]) => ({
        doctorId,
        fullName: doctorMap.get(doctorId)?.fullName ?? 'Unknown',
        quantity: stats.quantity,
        issues: stats.issues,
      })),
    };
  }

  public sampleAggregate(where: Prisma.StockTxnWhereInput) {
    return this.prisma.stockTxn.aggregate({
      where: { ...where, txnType: StockTxnTypes.SAMPLE_GIVEN },
      _sum: { qty: true },
      _count: { _all: true },
    });
  }

  public async warehouseStockReport(warehouseId: number) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        holderType: HolderTypes.WAREHOUSE,
        holderId: warehouseId,
        qty: { gt: 0 },
      },
      include: {
        medicine: { select: { id: true, name: true, company: true } },
        batch: { select: { batchNo: true } },
      },
      orderBy: { qty: 'asc' },
    });

    const grouped = new Map<
      number,
      {
        medicineId: number;
        medicineName: string;
        company: string | null;
        available: number;
      }
    >();

    for (const row of balances) {
      const existing = grouped.get(row.medicineId);
      if (existing) {
        existing.available += row.qty;
      } else {
        grouped.set(row.medicineId, {
          medicineId: row.medicineId,
          medicineName: row.medicine.name,
          company: row.medicine.company,
          available: row.qty,
        });
      }
    }

    const threshold = 10;
    return [...grouped.values()].map((row) => {
      const stats = { openingStock: 0, issued: 0, returned: 0, available: row.available };
      return {
        medicineId: row.medicineId,
        medicineName: row.medicineName,
        company: row.company,
        openingStock: stats.openingStock,
        issued: stats.issued,
        returned: stats.returned,
        available: row.available,
        minimumStockAlert: threshold,
        isLow: row.available <= threshold,
      };
    });
  }

  public async resolveBatchForIssue(params: {
    medicineId: number;
    batchNumber?: string;
    warehouseId: number;
    requiredQty: number;
  }): Promise<Batch | null> {
    if (params.batchNumber) {
      const batch = await this.findBatchByMedicineAndNo(params.medicineId, params.batchNumber);
      if (!batch) return null;
      const balance = await this.findWarehouseBalance({
        warehouseId: params.warehouseId,
        medicineId: params.medicineId,
        batchId: batch.id,
      });
      if (!balance || balance.qty < params.requiredQty) return null;
      return batch;
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        holderType: HolderTypes.WAREHOUSE,
        holderId: params.warehouseId,
        medicineId: params.medicineId,
        qty: { gte: params.requiredQty },
      },
      include: { batch: true },
      orderBy: { batch: { expiryDate: 'asc' } },
      take: 1,
    });
    return balances[0]?.batch ?? null;
  }

  public async resolveBatchForMrSample(params: {
    mrId: number;
    medicineId: number;
    batchNumber?: string;
    requiredQty: number;
  }): Promise<{ batchId: number; batchNo: string; available: number } | null> {
    if (params.batchNumber) {
      const batch = await this.findBatchByMedicineAndNo(params.medicineId, params.batchNumber);
      if (!batch) return null;
      const balance = await this.findHolderBalance({
        holderType: HolderTypes.USER,
        holderId: params.mrId,
        medicineId: params.medicineId,
        batchId: batch.id,
      });
      if (!balance || balance.qty < params.requiredQty) return null;
      return { batchId: batch.id, batchNo: batch.batchNo, available: balance.qty };
    }

    const balance = await this.prisma.stockBalance.findFirst({
      where: {
        holderType: HolderTypes.USER,
        holderId: params.mrId,
        medicineId: params.medicineId,
        qty: { gte: params.requiredQty },
      },
      include: { batch: true },
      orderBy: { batch: { expiryDate: 'asc' } },
    });
    if (!balance) return null;
    return {
      batchId: balance.batchId,
      batchNo: balance.batch.batchNo,
      available: balance.qty,
    };
  }
}

export type PostTxnInput = {
  txnType: StockTxnType;
  txnDate: Date;
  medicineId: number;
  batchId: number;
  qty: number;
  fromHolderType?: HolderType;
  fromHolderId?: number;
  toHolderType?: HolderType;
  toHolderId?: number;
  refType?: StockRefType;
  refId?: number;
  note?: string;
  createdBy: number;
  clientUuid?: string;
};
