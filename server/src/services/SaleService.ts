import { AppRoles } from '../constants';
import type { CreateSaleDto, ListSalesQueryDto } from '../dto/sale.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { SaleRepository } from '../repositories/SaleRepository';
import { PrismaService } from '../prisma/PrismaService';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../types/auth.types';

export class SaleService {
  private static instance: SaleService | null = null;
  private constructor(
    private readonly sales = SaleRepository.getInstance(),
    private readonly prisma = PrismaService.getClient(),
  ) {}
  public static getInstance(): SaleService {
    if (!SaleService.instance) SaleService.instance = new SaleService();
    return SaleService.instance;
  }

  public async list(query: ListSalesQueryDto, actor: AuthUser) {
    const { items, total } = await this.sales.list({
      page: query.page,
      limit: query.limit,
      mrId: actor.role === AppRoles.MR ? actor.id : query.mrId,
      medicineId: query.medicineId,
      doctorId: query.doctorId,
      medicalStoreId: query.medicalStoreId,
      from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
      to: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
    });
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

  public async create(dto: CreateSaleDto, actor: AuthUser) {
    if (!dto.doctorId && !dto.medicalStoreId) {
      throw new BadRequestError('Either doctor or medical store is required');
    }
    const mrId = actor.role === AppRoles.MR ? actor.id : dto.mrId;
    if (!mrId) throw new BadRequestError('MR is required');

    if (actor.role === AppRoles.MR && dto.mrId && dto.mrId !== actor.id) {
      throw new ForbiddenError('You can only create sales for yourself');
    }

    const medicine = await this.prisma.medicine.findFirst({
      where: { id: dto.medicineId, deletedAt: null },
    });
    if (!medicine) throw new NotFoundError('Medicine not found');

    const sale = await this.sales.create({
      quantity: dto.quantity,
      amount: new Prisma.Decimal(dto.amount),
      invoiceDate: new Date(`${dto.invoiceDate}T00:00:00.000Z`),
      invoiceNumber: dto.invoiceNumber,
      remarks: dto.remarks,
      createdBy: actor.id,
      updatedBy: actor.id,
      medicine: { connect: { id: dto.medicineId } },
      mr: { connect: { id: mrId } },
      ...(dto.doctorId ? { doctor: { connect: { id: dto.doctorId } } } : {}),
      ...(dto.medicalStoreId ? { medicalStore: { connect: { id: dto.medicalStoreId } } } : {}),
    });
    return this.toPublic(sale);
  }

  private toPublic(item: {
    id: number;
    quantity: number;
    amount: Prisma.Decimal | number;
    invoiceDate: Date;
    invoiceNumber: string | null;
    remarks: string | null;
    medicine: { id: number; name: string };
    doctor: { id: number; fullName: string } | null;
    medicalStore: { id: number; name: string } | null;
    mr: { id: number; fullName: string };
  }) {
    return {
      id: item.id,
      quantity: item.quantity,
      amount: Number(item.amount),
      invoiceDate: item.invoiceDate.toISOString().slice(0, 10),
      invoiceNumber: item.invoiceNumber,
      remarks: item.remarks,
      medicine: item.medicine,
      doctor: item.doctor,
      medicalStore: item.medicalStore,
      mr: item.mr,
    };
  }
}
