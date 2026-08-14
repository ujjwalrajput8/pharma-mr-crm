import type {
  CreateMedicineDto,
  ListMedicinesQueryDto,
  UpdateMedicineDto,
} from '../dto/medicine.dto';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { MedicineRepository } from '../repositories/MedicineRepository';
import { StockTxnRepository } from '../repositories/StockTxnRepository';
import { StockLedgerService } from './StockLedgerService';
import { Prisma } from '@prisma/client';

export class MedicineService {
  private static instance: MedicineService | null = null;

  private constructor(
    private readonly medicines = MedicineRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
  ) {}

  public static getInstance(): MedicineService {
    if (!MedicineService.instance) {
      MedicineService.instance = new MedicineService();
    }
    return MedicineService.instance;
  }

  public async list(query: ListMedicinesQueryDto) {
    const { items, total } = await this.medicines.list(query);
    const warehouseId = await this.ledger.getDefaultWarehouseId();
    const enriched = await Promise.all(
      items.map(async (item) => {
        const stats = await this.stockTxns.getWarehouseMedicineStats(warehouseId, item.id);
        return this.toPublic(item, stats);
      }),
    );
    return {
      items: enriched,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getById(id: number) {
    const medicine = await this.medicines.findById(id);
    if (!medicine) throw new NotFoundError('Medicine not found');
    const warehouseId = await this.ledger.getDefaultWarehouseId();
    const stats = await this.stockTxns.getWarehouseMedicineStats(warehouseId, id);
    return this.toPublic(medicine, stats);
  }

  public async getDetails(id: number) {
    const medicine = await this.medicines.findById(id);
    if (!medicine) throw new NotFoundError('Medicine not found');
    const warehouseId = await this.ledger.getDefaultWarehouseId();
    const [bundle, stats, mrHoldings] = await Promise.all([
      this.medicines.getDetailBundle(id),
      this.stockTxns.getWarehouseMedicineStats(warehouseId, id),
      this.stockTxns.listUserHoldings(id),
    ]);

    const samplesIssued = bundle.distributions.reduce((sum, row) => sum + row.quantity, 0);
    const issuedToMr = mrHoldings.reduce((sum, row) => sum + row.quantity, 0);

    return {
      profile: this.toPublic(medicine, stats),
      stats: {
        samplesIssued,
        currentStock: stats.available,
        remainingStock: stats.available,
        openingStock: stats.openingStock,
        issuedStock: stats.issued,
        issuedToMr,
        companyRemaining: stats.available,
        mrRecipients: bundle.mrWise.length,
        doctorRecipients: bundle.doctorWise.length,
      },
      mrHoldings,
      mrWise: bundle.mrWise,
      doctorWise: bundle.doctorWise,
      timeline: bundle.distributions.map((row) => ({
        id: row.id,
        date: row.distributedAt.toISOString().slice(0, 10),
        quantity: row.quantity,
        batchNumber: row.batchNumber,
        doctorName: row.doctor?.fullName ?? 'Unknown',
        mrName: row.mr?.fullName ?? 'Unknown',
        visitId: row.visitId,
        visitDate: row.visit?.visitDate.toISOString().slice(0, 10) ?? null,
      })),
    };
  }

  public async create(dto: CreateMedicineDto, actorId: number) {
    const { openingStock, minimumStockAlert: _minimumStockAlert, mrp, expiryDate, batchNumber, ...rest } = dto;
    try {
      const medicine = await this.medicines.createWithStock(
        {
          ...rest,
          mrp: new Prisma.Decimal(mrp),
          createdBy: actorId,
          updatedBy: actorId,
        },
        openingStock,
        batchNumber ?? `B-${Date.now()}`,
        expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`) : null,
        actorId,
      );
      const warehouseId = await this.ledger.getDefaultWarehouseId();
      const stats = await this.stockTxns.getWarehouseMedicineStats(warehouseId, medicine.id);
      return this.toPublic(medicine, stats);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('A medicine with this SKU already exists');
      }
      throw error;
    }
  }

  public async update(id: number, dto: UpdateMedicineDto, actorId: number) {
    await this.getById(id);
    const { mrp, expiryDate: _expiryDate, batchNumber: _batchNumber, ...rest } = dto;
    const medicine = await this.medicines.update(id, {
      ...rest,
      ...(mrp !== undefined ? { mrp: new Prisma.Decimal(mrp) } : {}),
      updatedBy: actorId,
    });
    return this.getById(medicine.id);
  }

  public async remove(id: number, actorId: number) {
    await this.getById(id);
    await this.medicines.softDelete(id, actorId);
  }

  private toPublic(
    medicine: NonNullable<Awaited<ReturnType<MedicineRepository['findById']>>>,
    stats?: { openingStock: number; issued: number; returned: number; available: number },
  ) {
    const primaryBatch = medicine.batches[0] ?? null;
    const stockStats = stats ?? { openingStock: 0, issued: 0, returned: 0, available: 0 };
    const minimumStockAlert = 10;

    return {
      id: medicine.id,
      name: medicine.name,
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      company: medicine.company,
      composition: medicine.composition,
      strength: medicine.strength,
      category: medicine.category,
      packSize: medicine.packSize,
      mrp: Number(medicine.mrp),
      sku: medicine.sku,
      batchNumber: primaryBatch?.batchNo ?? null,
      expiryDate: primaryBatch?.expiryDate
        ? primaryBatch.expiryDate.toISOString().slice(0, 10)
        : null,
      batches: medicine.batches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate ? batch.expiryDate.toISOString().slice(0, 10) : null,
      })),
      description: medicine.description,
      sampleAvailable: medicine.sampleAvailable,
      status: medicine.status,
      stock: {
        openingStock: stockStats.openingStock,
        issued: stockStats.issued,
        returned: stockStats.returned,
        available: stockStats.available,
        minimumStockAlert,
        isLow: stockStats.available <= minimumStockAlert,
      },
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    };
  }
}
