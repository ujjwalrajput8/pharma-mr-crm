import { Prisma } from '@prisma/client';
import { AppRoles } from '../constants';
import type {
  CreateInvoiceDto,
  InvoiceSummaryQueryDto,
  ListInvoicesQueryDto,
  RecordPaymentDto,
} from '../dto/invoice.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { AuditService } from './AuditService';
import { TeamScopeService } from './TeamScopeService';
import { formatDateOnly, parseDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Money comparisons tolerate float noise from Decimal → Number conversion. */
const EPSILON = 0.005;

interface InvoiceHeaderRow {
  id: number;
  invoiceNo: string;
  invoiceDate: Date;
  dueDate: Date | null;
  remarks: string | null;
  status: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  doctor: { id: number; fullName: string } | null;
  medicalStore: { id: number; name: string } | null;
  mr: { id: number; fullName: string };
  createdAt: Date;
}

/**
 * InvoiceService — doctor/chemist billing on top of the existing Sale lines.
 *
 * An Invoice is the bill header; its lines are ordinary `Sale` rows carrying
 * `invoiceId`, so every existing sales report keeps working. Payments are
 * appended and `paidAmount`/`status` are re-derived, never edited by hand.
 * Cancelling soft-deletes the Sale lines so reports exclude the business.
 */
export class InvoiceService {
  private static instance: InvoiceService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): InvoiceService {
    if (!InvoiceService.instance) InvoiceService.instance = new InvoiceService();
    return InvoiceService.instance;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  public async create(dto: CreateInvoiceDto, actor: AuthUser) {
    const mrId = actor.role === AppRoles.MR ? actor.id : (dto.mrId ?? actor.id);
    if (actor.role === AppRoles.MR && dto.mrId && dto.mrId !== actor.id) {
      throw new ForbiddenError('You can only raise invoices for yourself');
    }
    await this.scope.assertCanSee(actor, mrId);

    if (dto.doctorId) {
      const doctor = await this.prisma.doctor.findFirst({
        where: { id: dto.doctorId, deletedAt: null },
      });
      if (!doctor) throw new NotFoundError('Doctor not found');
    }
    if (dto.medicalStoreId) {
      const store = await this.prisma.medicalStore.findFirst({
        where: { id: dto.medicalStoreId, deletedAt: null },
      });
      if (!store) throw new NotFoundError('Medical store not found');
    }

    const medicineIds = [...new Set(dto.lines.map((line) => line.medicineId))];
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    const medicineById = new Map(medicines.map((m) => [m.id, m]));
    for (const line of dto.lines) {
      if (!medicineById.has(line.medicineId)) {
        throw new NotFoundError(`Medicine #${line.medicineId} not found`);
      }
    }

    const invoiceDate = parseDateOnly(dto.invoiceDate);
    const dueDate = dto.dueDate ? parseDateOnly(dto.dueDate) : null;
    if (dueDate && dueDate < invoiceDate) {
      throw new BadRequestError('Due date cannot be before the invoice date');
    }

    const computed = dto.lines.map((line) => {
      const discountPct = line.discountPct ?? 0;
      const gross = line.quantity * line.rate;
      return {
        ...line,
        discountPct,
        gross: round2(gross),
        amount: round2(gross * (1 - discountPct / 100)),
      };
    });
    const subtotal = round2(computed.reduce((sum, line) => sum + line.gross, 0));
    const totalAmount = round2(computed.reduce((sum, line) => sum + line.amount, 0));
    const discountAmount = round2(subtotal - totalAmount);

    // Unique invoiceNo; retry on the (rare) collision race.
    let created: { id: number; invoiceNo: string } | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      const invoiceNo = await this.generateInvoiceNo(invoiceDate, attempt > 0);
      try {
        created = await this.prisma.$transaction(async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNo,
              invoiceDate,
              dueDate,
              remarks: dto.remarks,
              doctorId: dto.doctorId ?? null,
              medicalStoreId: dto.medicalStoreId ?? null,
              mrId,
              subtotal: new Prisma.Decimal(subtotal),
              discountAmount: new Prisma.Decimal(discountAmount),
              totalAmount: new Prisma.Decimal(totalAmount),
              paidAmount: new Prisma.Decimal(0),
              status: 'UNPAID',
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          });
          await tx.sale.createMany({
            data: computed.map((line) => ({
              invoiceId: invoice.id,
              doctorId: dto.doctorId ?? null,
              medicalStoreId: dto.medicalStoreId ?? null,
              medicineId: line.medicineId,
              mrId,
              quantity: line.quantity,
              rate: new Prisma.Decimal(line.rate),
              discountPct: new Prisma.Decimal(line.discountPct),
              amount: new Prisma.Decimal(line.amount),
              invoiceDate,
              invoiceNumber: invoiceNo,
              createdBy: actor.id,
              updatedBy: actor.id,
            })),
          });
          return { id: invoice.id, invoiceNo: invoice.invoiceNo };
        });
      } catch (error) {
        const isDuplicateNo =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isDuplicateNo || attempt === 2) throw error;
      }
    }
    if (!created) throw new BadRequestError('Could not allocate an invoice number, try again');

    await this.audits.log({
      userId: actor.id,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: String(created.id),
      metadata: {
        invoiceNo: created.invoiceNo,
        doctorId: dto.doctorId ?? null,
        medicalStoreId: dto.medicalStoreId ?? null,
        mrId,
        lines: dto.lines.length,
        subtotal,
        discountAmount,
        totalAmount,
      },
    });

    return this.getById(created.id, actor);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  public async list(query: ListInvoicesQueryDto, actor: AuthUser) {
    const mrFilter = await this.scope.resolveMrFilter(actor, query.mrId);
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(mrFilter.mrId ? { mrId: mrFilter.mrId } : {}),
      ...(mrFilter.mrIds ? { mrId: { in: mrFilter.mrIds } } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.medicalStoreId ? { medicalStoreId: query.medicalStoreId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNo: { contains: query.search, mode: 'insensitive' } },
              { doctor: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { medicalStore: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          doctor: { select: { id: true, fullName: true } },
          medicalStore: { select: { id: true, name: true } },
          mr: { select: { id: true, fullName: true } },
          _count: { select: { lines: { where: { deletedAt: null } } } },
        },
        orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...this.toHeader(item),
        lineCount: item._count.lines,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getById(id: number, actor: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: { select: { id: true, fullName: true } },
        medicalStore: { select: { id: true, name: true } },
        mr: { select: { id: true, fullName: true } },
        lines: {
          where: { deletedAt: null },
          include: { medicine: { select: { id: true, name: true } } },
          orderBy: { id: 'asc' },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    await this.scope.assertCanSee(actor, invoice.mrId);

    return {
      ...this.toHeader(invoice),
      lineCount: invoice.lines.length,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        medicine: line.medicine,
        quantity: line.quantity,
        rate: line.rate === null ? null : Number(line.rate),
        discountPct: line.discountPct === null ? 0 : Number(line.discountPct),
        amount: Number(line.amount),
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentDate: formatDateOnly(payment.paymentDate),
        mode: payment.mode,
        reference: payment.reference,
        remarks: payment.remarks,
        createdAt: payment.createdAt.toISOString(),
      })),
    };
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  public async addPayment(invoiceId: number, dto: RecordPaymentDto, actor: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    await this.scope.assertCanSee(actor, invoice.mrId);

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestError('This invoice is cancelled — payments cannot be recorded');
    }
    const total = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const outstanding = round2(total - paid);
    if (dto.amount > outstanding + EPSILON) {
      throw new BadRequestError(
        `Payment exceeds the outstanding amount (₹${outstanding.toFixed(2)} due)`,
      );
    }

    const newPaid = round2(paid + dto.amount);
    const payment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.payment.create({
        data: {
          invoiceId,
          amount: new Prisma.Decimal(dto.amount),
          paymentDate: parseDateOnly(dto.paymentDate),
          mode: dto.mode,
          reference: dto.reference,
          remarks: dto.remarks,
          createdBy: actor.id,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(newPaid),
          status: this.deriveStatus(newPaid, total),
          updatedBy: actor.id,
        },
      });
      return row;
    });

    await this.audits.log({
      userId: actor.id,
      action: 'RECORD_PAYMENT',
      entity: 'Invoice',
      entityId: String(invoiceId),
      metadata: {
        paymentId: payment.id,
        invoiceNo: invoice.invoiceNo,
        amount: dto.amount,
        mode: dto.mode,
        reference: dto.reference ?? null,
        paidAmount: newPaid,
      },
    });

    return this.getById(invoiceId, actor);
  }

  public async removePayment(invoiceId: number, paymentId: number, actor: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    await this.scope.assertCanSee(actor, invoice.mrId);

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, invoiceId, deletedAt: null },
    });
    if (!payment) throw new NotFoundError('Payment not found');

    const total = Number(invoice.totalAmount);
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { deletedAt: new Date() },
      });
      const remaining = await tx.payment.aggregate({
        where: { invoiceId, deletedAt: null },
        _sum: { amount: true },
      });
      const newPaid = round2(Number(remaining._sum.amount ?? 0));
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(newPaid),
          ...(invoice.status !== 'CANCELLED'
            ? { status: this.deriveStatus(newPaid, total) }
            : {}),
          updatedBy: actor.id,
        },
      });
    });

    await this.audits.log({
      userId: actor.id,
      action: 'DELETE_PAYMENT',
      entity: 'Invoice',
      entityId: String(invoiceId),
      metadata: {
        paymentId,
        invoiceNo: invoice.invoiceNo,
        amount: Number(payment.amount),
        mode: payment.mode,
      },
    });

    return this.getById(invoiceId, actor);
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  public async cancel(invoiceId: number, actor: AuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    await this.scope.assertCanSee(actor, invoice.mrId);

    if (invoice.status === 'CANCELLED') throw new BadRequestError('Already cancelled');
    if (Number(invoice.paidAmount) > EPSILON) {
      throw new BadRequestError('Delete its payments first — a paid invoice cannot be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'CANCELLED', updatedBy: actor.id },
      });
      // Reports read Sale rows; soft-deleting the lines removes the business.
      await tx.sale.updateMany({
        where: { invoiceId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
    });

    await this.audits.log({
      userId: actor.id,
      action: 'CANCEL',
      entity: 'Invoice',
      entityId: String(invoiceId),
      metadata: { invoiceNo: invoice.invoiceNo, totalAmount: Number(invoice.totalAmount) },
    });

    return this.getById(invoiceId, actor);
  }

  // ── Doctor / store / MR wise summary ───────────────────────────────────────

  public async summary(query: InvoiceSummaryQueryDto, actor: AuthUser) {
    const mrFilter = await this.scope.resolveMrFilter(actor, undefined);
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      status: { not: 'CANCELLED' },
      ...(mrFilter.mrId ? { mrId: mrFilter.mrId } : {}),
      ...(mrFilter.mrIds ? { mrId: { in: mrFilter.mrIds } } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.groupBy === 'doctor' ? { doctorId: { not: null } } : {}),
      ...(query.groupBy === 'store' ? { medicalStoreId: { not: null } } : {}),
    };

    const rows = await this.prisma.invoice.findMany({
      where,
      select: {
        doctorId: true,
        medicalStoreId: true,
        mrId: true,
        totalAmount: true,
        paidAmount: true,
        invoiceDate: true,
        doctor: { select: { fullName: true } },
        medicalStore: { select: { name: true } },
        mr: { select: { fullName: true } },
      },
    });

    interface Bucket {
      id: number;
      name: string;
      invoices: number;
      billed: number;
      paid: number;
      lastInvoiceDate: string | null;
    }
    const buckets = new Map<number, Bucket>();
    for (const row of rows) {
      let id: number | null = null;
      let name = '—';
      if (query.groupBy === 'doctor') {
        id = row.doctorId;
        name = row.doctor?.fullName ?? `Doctor #${row.doctorId}`;
      } else if (query.groupBy === 'store') {
        id = row.medicalStoreId;
        name = row.medicalStore?.name ?? `Store #${row.medicalStoreId}`;
      } else {
        id = row.mrId;
        name = row.mr.fullName;
      }
      if (id === null) continue;

      const bucket = buckets.get(id) ?? {
        id,
        name,
        invoices: 0,
        billed: 0,
        paid: 0,
        lastInvoiceDate: null,
      };
      bucket.invoices += 1;
      bucket.billed = round2(bucket.billed + Number(row.totalAmount));
      bucket.paid = round2(bucket.paid + Number(row.paidAmount));
      const date = formatDateOnly(row.invoiceDate);
      if (!bucket.lastInvoiceDate || date > bucket.lastInvoiceDate) {
        bucket.lastInvoiceDate = date;
      }
      buckets.set(id, bucket);
    }

    const groups = [...buckets.values()]
      .map((bucket) => ({ ...bucket, outstanding: round2(bucket.billed - bucket.paid) }))
      .sort((a, b) => b.outstanding - a.outstanding || b.billed - a.billed);

    const totals = groups.reduce(
      (acc, group) => ({
        invoices: acc.invoices + group.invoices,
        billed: round2(acc.billed + group.billed),
        paid: round2(acc.paid + group.paid),
        outstanding: round2(acc.outstanding + group.outstanding),
      }),
      { invoices: 0, billed: 0, paid: 0, outstanding: 0 },
    );

    return { groupBy: query.groupBy, from: query.from ?? null, to: query.to ?? null, groups, totals };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private deriveStatus(paid: number, total: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    if (total > 0 && paid >= total - EPSILON) return 'PAID';
    if (paid > EPSILON) return 'PARTIAL';
    return 'UNPAID';
  }

  /** `INV-<yyyymmdd>-<seq>`; randomised once a collision has been seen. */
  private async generateInvoiceNo(invoiceDate: Date, randomise: boolean): Promise<string> {
    const ymd = formatDateOnly(invoiceDate).replace(/-/g, '');
    if (!randomise) {
      const sameDay = await this.prisma.invoice.count({ where: { invoiceDate } });
      const candidate = `INV-${ymd}-${String(sameDay + 1).padStart(4, '0')}`;
      const clash = await this.prisma.invoice.findUnique({ where: { invoiceNo: candidate } });
      if (!clash) return candidate;
    }
    return `INV-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private toHeader(item: InvoiceHeaderRow) {
    const total = Number(item.totalAmount);
    const paid = Number(item.paidAmount);
    return {
      id: item.id,
      invoiceNo: item.invoiceNo,
      invoiceDate: formatDateOnly(item.invoiceDate),
      dueDate: item.dueDate ? formatDateOnly(item.dueDate) : null,
      remarks: item.remarks,
      status: item.status,
      party: item.doctor
        ? { type: 'DOCTOR' as const, id: item.doctor.id, name: item.doctor.fullName }
        : item.medicalStore
          ? { type: 'STORE' as const, id: item.medicalStore.id, name: item.medicalStore.name }
          : null,
      mr: item.mr,
      subtotal: Number(item.subtotal),
      discountAmount: Number(item.discountAmount),
      totalAmount: total,
      paidAmount: paid,
      outstanding: round2(total - paid),
      createdAt: item.createdAt.toISOString(),
    };
  }
}
