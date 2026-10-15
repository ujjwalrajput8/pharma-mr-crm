import type { ExpenseStatus, Prisma } from '@prisma/client';
import { AppRoles } from '../constants';
import type {
  CreateExpenseDto,
  DecideExpenseDto,
  ExpenseSummaryQueryDto,
  ListExpensesQueryDto,
  UpdateExpenseDto,
} from '../dto/expense.dto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { AuditService } from './AuditService';
import { FileStorageService } from './FileStorageService';
import { NotificationService } from './NotificationService';
import { TeamScopeService } from './TeamScopeService';
import {
  formatDateOnly,
  monthRange,
  parseDateOnly,
  todayDateOnly,
} from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

const claimInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      managerId: true,
      mrProfile: { select: { employeeCode: true } },
    },
  },
  decidedBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.ExpenseClaimInclude;

type ClaimRow = Prisma.ExpenseClaimGetPayload<{ include: typeof claimInclude }>;

export interface PublicExpenseClaim {
  id: number;
  userId: number;
  employee: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    employeeCode: string | null;
  } | null;
  expenseDate: string;
  category: string;
  amount: number;
  distanceKm: number | null;
  description: string;
  receiptFileKey: string | null;
  status: string;
  decisionRemark: string | null;
  actedAt: string | null;
  decidedBy: { id: number; fullName: string } | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * ExpenseService — TA/DA claims: MR files → manager approves → admin marks paid.
 * All writes are audited; decisions land in the requester's notification bell.
 */
export class ExpenseService {
  private static instance: ExpenseService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
    private readonly notifications = NotificationService.getInstance(),
    private readonly files = FileStorageService.getInstance(),
  ) {}

  public static getInstance(): ExpenseService {
    if (!ExpenseService.instance) ExpenseService.instance = new ExpenseService();
    return ExpenseService.instance;
  }

  public async create(dto: CreateExpenseDto, actor: AuthUser): Promise<PublicExpenseClaim> {
    if (actor.role === AppRoles.ADMIN) {
      throw new ForbiddenError('Admin workspace accounts do not file expense claims');
    }
    const expenseDate = parseDateOnly(dto.expenseDate);
    if (expenseDate.getTime() > todayDateOnly().getTime()) {
      throw new BadRequestError('Expense date cannot be in the future');
    }
    if (dto.receiptFileKey) await this.files.assertExists(dto.receiptFileKey);

    const row = await this.prisma.expenseClaim.create({
      data: {
        userId: actor.id,
        expenseDate,
        category: dto.category,
        amount: dto.amount,
        distanceKm: dto.distanceKm,
        description: dto.description,
        receiptFileKey: dto.receiptFileKey,
        status: 'PENDING',
      },
      include: claimInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'EXPENSE_CREATED',
      entity: 'ExpenseClaim',
      entityId: String(row.id),
      metadata: {
        expenseDate: dto.expenseDate,
        category: dto.category,
        amount: dto.amount,
      },
    });

    return this.toPublic(row);
  }

  public async update(
    id: number,
    dto: UpdateExpenseDto,
    actor: AuthUser,
  ): Promise<PublicExpenseClaim> {
    const row = await this.findOwnPending(id, actor);
    if (dto.expenseDate) {
      const expenseDate = parseDateOnly(dto.expenseDate);
      if (expenseDate.getTime() > todayDateOnly().getTime()) {
        throw new BadRequestError('Expense date cannot be in the future');
      }
    }
    if (dto.receiptFileKey) await this.files.assertExists(dto.receiptFileKey);

    const updated = await this.prisma.expenseClaim.update({
      where: { id: row.id },
      data: {
        ...(dto.expenseDate !== undefined
          ? { expenseDate: parseDateOnly(dto.expenseDate) }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.distanceKm !== undefined ? { distanceKm: dto.distanceKm } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.receiptFileKey !== undefined ? { receiptFileKey: dto.receiptFileKey } : {}),
      },
      include: claimInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'EXPENSE_UPDATED',
      entity: 'ExpenseClaim',
      entityId: String(id),
      metadata: { changes: Object.keys(dto) },
    });

    return this.toPublic(updated);
  }

  public async remove(id: number, actor: AuthUser): Promise<void> {
    const row = await this.findOwnPending(id, actor);
    await this.prisma.expenseClaim.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
    await this.audits.log({
      userId: actor.id,
      action: 'EXPENSE_DELETED',
      entity: 'ExpenseClaim',
      entityId: String(id),
      metadata: { amount: Number(row.amount), category: row.category },
    });
  }

  public async list(query: ListExpensesQueryDto, actor: AuthUser) {
    const scope = await this.resolveScope(actor, query.userId);
    const range = query.month ? this.monthWindow(query.month) : undefined;

    const where: Prisma.ExpenseClaimWhereInput = {
      deletedAt: null,
      ...(scope.userId
        ? { userId: scope.userId }
        : scope.userIds
          ? { userId: { in: scope.userIds } }
          : {}),
      ...(query.status ? { status: query.status as ExpenseStatus } : {}),
      ...(range ? { expenseDate: { gte: range.start, lte: range.end } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: claimInclude,
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

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

  public async decide(
    id: number,
    dto: DecideExpenseDto,
    actor: AuthUser,
  ): Promise<PublicExpenseClaim> {
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('Only a manager or administrator can decide expense claims');
    }
    const row = await this.prisma.expenseClaim.findFirst({
      where: { id, deletedAt: null },
      include: claimInclude,
    });
    if (!row) throw new NotFoundError('Expense claim not found');
    if (row.status !== 'PENDING') {
      throw new BadRequestError(`This claim is already ${row.status.toLowerCase()}`);
    }
    if (row.userId === actor.id) {
      throw new ForbiddenError('You cannot approve your own expense claim');
    }
    await this.scope.assertCanSee(actor, row.userId);

    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: dto.status,
        decidedById: actor.id,
        actedAt: new Date(),
        decisionRemark: dto.remark,
      },
      include: claimInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'EXPENSE_DECIDED',
      entity: 'ExpenseClaim',
      entityId: String(id),
      metadata: {
        employeeId: row.userId,
        status: dto.status,
        amount: Number(row.amount),
        remark: dto.remark ?? null,
      },
    });

    await this.notifications.create({
      userId: row.userId,
      kind: 'EXPENSE_DECIDED',
      title: `Expense claim ${dto.status.toLowerCase()} — ₹${Number(row.amount).toLocaleString('en-IN')}`,
      message: [
        `${row.category} · ${formatDateOnly(row.expenseDate)}`,
        dto.remark,
      ]
        .filter(Boolean)
        .join(' · '),
      href: '/expenses',
      tone: dto.status === 'APPROVED' ? 'success' : 'danger',
    });

    return this.toPublic(updated);
  }

  /** ADMIN settles an APPROVED claim. */
  public async markPaid(id: number, actor: AuthUser): Promise<PublicExpenseClaim> {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only an administrator can mark claims as paid');
    }
    const row = await this.prisma.expenseClaim.findFirst({
      where: { id, deletedAt: null },
      include: claimInclude,
    });
    if (!row) throw new NotFoundError('Expense claim not found');
    if (row.status !== 'APPROVED') {
      throw new BadRequestError('Only approved claims can be marked paid');
    }

    const paidAt = new Date();
    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: { status: 'PAID', paidAt },
      include: claimInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'EXPENSE_PAID',
      entity: 'ExpenseClaim',
      entityId: String(id),
      metadata: { employeeId: row.userId, amount: Number(row.amount) },
    });

    await this.notifications.create({
      userId: row.userId,
      kind: 'EXPENSE_PAID',
      title: `₹${Number(row.amount).toLocaleString('en-IN')} expense paid out`,
      message: `${row.category} · ${formatDateOnly(row.expenseDate)}`,
      href: '/expenses',
      tone: 'success',
    });

    return this.toPublic(updated);
  }

  /** Per-user totals by status for one month — the settlement sheet. */
  public async summary(query: ExpenseSummaryQueryDto, actor: AuthUser) {
    const scope = await this.resolveScope(actor);
    const range = this.monthWindow(query.month ?? formatDateOnly(todayDateOnly()).slice(0, 7));

    const rows = await this.prisma.expenseClaim.findMany({
      where: {
        deletedAt: null,
        expenseDate: { gte: range.start, lte: range.end },
        ...(scope.userId
          ? { userId: scope.userId }
          : scope.userIds
            ? { userId: { in: scope.userIds } }
            : {}),
      },
      include: { user: { select: { id: true, fullName: true } } },
    });

    const byUser = new Map<
      number,
      { userId: number; fullName: string; pending: number; approved: number; paid: number; rejected: number; total: number; claims: number }
    >();
    for (const row of rows) {
      const entry = byUser.get(row.userId) ?? {
        userId: row.userId,
        fullName: row.user.fullName,
        pending: 0,
        approved: 0,
        paid: 0,
        rejected: 0,
        total: 0,
        claims: 0,
      };
      const amount = Number(row.amount);
      if (row.status === 'PENDING') entry.pending += amount;
      else if (row.status === 'APPROVED') entry.approved += amount;
      else if (row.status === 'PAID') entry.paid += amount;
      else if (row.status === 'REJECTED') entry.rejected += amount;
      if (row.status !== 'REJECTED' && row.status !== 'CANCELLED') entry.total += amount;
      entry.claims += 1;
      byUser.set(row.userId, entry);
    }

    return {
      month: formatDateOnly(range.start).slice(0, 7),
      users: [...byUser.values()].sort((a, b) => b.total - a.total),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async findOwnPending(id: number, actor: AuthUser): Promise<ClaimRow> {
    const row = await this.prisma.expenseClaim.findFirst({
      where: { id, deletedAt: null },
      include: claimInclude,
    });
    if (!row) throw new NotFoundError('Expense claim not found');
    if (row.userId !== actor.id) {
      throw new ForbiddenError('You can only change your own expense claims');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestError('Only pending claims can be changed');
    }
    return row;
  }

  private async resolveScope(
    actor: AuthUser,
    requestedUserId?: number,
  ): Promise<{ userId?: number; userIds?: number[] }> {
    const canManageTeam = (actor.permissions ?? []).includes('expenses:manage');
    if (!canManageTeam || actor.role === AppRoles.MR) {
      if (requestedUserId && requestedUserId !== actor.id) {
        throw new ForbiddenError('You can only view your own expense claims');
      }
      return { userId: actor.id };
    }
    if (actor.role === AppRoles.ADMIN) {
      return requestedUserId ? { userId: requestedUserId } : {};
    }
    const teamIds = (await this.scope.visibleUserIds(actor)) ?? [];
    if (requestedUserId) {
      if (!teamIds.includes(requestedUserId)) {
        throw new ForbiddenError('That employee is outside your team scope');
      }
      return { userId: requestedUserId };
    }
    return { userIds: teamIds };
  }

  private monthWindow(month: string): { start: Date; end: Date } {
    const anchor = parseDateOnly(month.length === 7 ? `${month}-01` : month);
    return monthRange(anchor);
  }

  private toPublic(row: ClaimRow): PublicExpenseClaim {
    return {
      id: row.id,
      userId: row.userId,
      employee: row.user
        ? {
            id: row.user.id,
            fullName: row.user.fullName,
            email: row.user.email,
            role: row.user.role,
            employeeCode: row.user.mrProfile?.employeeCode ?? null,
          }
        : null,
      expenseDate: formatDateOnly(row.expenseDate),
      category: row.category,
      amount: Number(row.amount),
      distanceKm: row.distanceKm !== null ? Number(row.distanceKm) : null,
      description: row.description,
      receiptFileKey: row.receiptFileKey,
      status: row.status,
      decisionRemark: row.decisionRemark,
      actedAt: row.actedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy
        ? { id: row.decidedBy.id, fullName: row.decidedBy.fullName }
        : null,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
