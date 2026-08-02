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

  public async getById(id: string) {
    const medicine = await this.medicines.findById(id);
    if (!medicine) throw new NotFoundError('Medicine not found');
    return this.toPublic(medicine);
  }

  public async create(dto: CreateMedicineDto, actorId: string) {
    const { openingStock, minimumStockAlert, mrp, ...rest } = dto;
    try {
      const medicine = await this.medicines.createWithStock(
        {
          ...rest,
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

  public async update(id: string, dto: UpdateMedicineDto, actorId: string) {
    await this.getById(id);
    const { mrp, ...rest } = dto;
    const medicine = await this.medicines.update(id, {
      ...rest,
      ...(mrp !== undefined ? { mrp: new Prisma.Decimal(mrp) } : {}),
      updatedBy: actorId,
    });
    return this.getById(medicine.id);
  }

  public async remove(id: string, actorId: string) {
    await this.getById(id);
    await this.medicines.softDelete(id, actorId);
  }

  private toPublic(medicine: NonNullable<Awaited<ReturnType<MedicineRepository['findById']>>>) {
    return {
      id: medicine.id,
      name: medicine.name,
      company: medicine.company,
      composition: medicine.composition,
      strength: medicine.strength,
      category: medicine.category,
      packSize: medicine.packSize,
      mrp: Number(medicine.mrp),
      sku: medicine.sku,
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
