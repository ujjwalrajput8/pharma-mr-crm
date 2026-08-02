import type {
  CreateMedicineDto,
  ListMedicinesQueryDto,
  UpdateMedicineDto,
} from '../dto/medicine.dto';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { MedicineRepository } from '../repositories/MedicineRepository';
import { Prisma } from '../../generated/prisma/client';

export class MedicineService {
  private static instance: MedicineService | null = null;

  private constructor(private readonly medicines = MedicineRepository.getInstance()) {}

  public static getInstance(): MedicineService {
    if (!MedicineService.instance) {
      MedicineService.instance = new MedicineService();
    }
    return MedicineService.instance;
  }

  public async list(query: ListMedicinesQueryDto) {
    const { items, total } = await this.medicines.list(query);
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

  public async getById(id: number) {
    const medicine = await this.medicines.findById(id);
    if (!medicine) throw new NotFoundError('Medicine not found');
    return this.toPublic(medicine);
  }

  public async getDetails(id: number) {
    const medicine = await this.medicines.findById(id);
    if (!medicine) throw new NotFoundError('Medicine not found');
    const bundle = await this.medicines.getDetailBundle(id);
    const samplesIssued = bundle.distributions.reduce((sum, row) => sum + row.quantity, 0);
    const stock = medicine.stock;
    const prisma = this.medicines.getPrisma();
    const mrStocks = await prisma.mrStock.findMany({
      where: { medicineId: id, deletedAt: null, quantity: { gt: 0 } },
      include: { mr: { select: { id: true, fullName: true, email: true } } },
      orderBy: { quantity: 'desc' },
    });

    return {
      profile: this.toPublic(medicine),
      stats: {
        samplesIssued,
        currentStock: stock?.available ?? 0,
        remainingStock: stock?.available ?? 0,
        openingStock: stock?.openingStock ?? 0,
        issuedStock: stock?.issued ?? 0,
        issuedToMr: mrStocks.reduce((sum, row) => sum + row.quantity, 0),
        companyRemaining: stock?.available ?? 0,
        mrRecipients: bundle.mrWise.length,
        doctorRecipients: bundle.doctorWise.length,
      },
      mrHoldings: mrStocks.map((row) => ({
        mrId: row.mrId,
        fullName: row.mr.fullName,
        email: row.mr.email,
        quantity: row.quantity,
        batchNumber: row.batchNumber,
      })),
      mrWise: bundle.mrWise,
      doctorWise: bundle.doctorWise,
      timeline: bundle.distributions.map((row) => ({
        id: row.id,
        date: row.distributedAt.toISOString().slice(0, 10),
        quantity: row.quantity,
        batchNumber: row.batchNumber,
        doctorName: row.doctor.fullName,
        mrName: row.mr.fullName,
        visitId: row.visitId,
        visitDate: row.visit.visitDate.toISOString().slice(0, 10),
      })),
    };
  }

  public async create(dto: CreateMedicineDto, actorId: number) {
    const { openingStock, minimumStockAlert, mrp, expiryDate, ...rest } = dto;
    try {
      const medicine = await this.medicines.createWithStock(
        {
          ...rest,
          ...(expiryDate ? { expiryDate: new Date(`${expiryDate}T00:00:00.000Z`) } : {}),
          mrp: new Prisma.Decimal(mrp),
          createdBy: actorId,
          updatedBy: actorId,
        },
        openingStock,
        minimumStockAlert,
      );
      return this.toPublic(medicine);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('A medicine with this SKU already exists');
      }
      throw error;
    }
  }

  public async update(id: number, dto: UpdateMedicineDto, actorId: number) {
    await this.getById(id);
    const { mrp, expiryDate, ...rest } = dto;
    const medicine = await this.medicines.update(id, {
      ...rest,
      ...(expiryDate !== undefined
        ? { expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`) : null }
        : {}),
      ...(mrp !== undefined ? { mrp: new Prisma.Decimal(mrp) } : {}),
      updatedBy: actorId,
    });
    return this.getById(medicine.id);
  }

  public async remove(id: number, actorId: number) {
    await this.getById(id);
    await this.medicines.softDelete(id, actorId);
  }

  private toPublic(medicine: NonNullable<Awaited<ReturnType<MedicineRepository['findById']>>>) {
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
      batchNumber: medicine.batchNumber,
      expiryDate: medicine.expiryDate ? medicine.expiryDate.toISOString().slice(0, 10) : null,
      description: medicine.description,
      sampleAvailable: medicine.sampleAvailable,
      status: medicine.status,
      stock: medicine.stock
        ? {
            openingStock: medicine.stock.openingStock,
            issued: medicine.stock.issued,
            returned: medicine.stock.returned,
            available: medicine.stock.available,
            minimumStockAlert: medicine.stock.minimumStockAlert,
            isLow: medicine.stock.available <= medicine.stock.minimumStockAlert,
          }
        : null,
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    };
  }
}
