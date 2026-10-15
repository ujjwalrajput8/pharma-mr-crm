import { Prisma } from '@prisma/client';
import { AppRoles } from '../constants';
import type {
  ListTargetsQueryDto,
  TargetProgressQueryDto,
  UpsertTargetDto,
} from '../dto/target.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { AuditService } from './AuditService';
import { TeamScopeService } from './TeamScopeService';
import {
  formatDateOnly,
  monthRange,
  parseDateOnly,
  toLocalDateString,
} from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * TargetService — monthly rupee targets per MR (optionally per medicine) and
 * the achieved-vs-target progress view. Achievement is always recomputed from
 * live Sale rows (deletedAt null), so cancelled invoices drop out automatically.
 */
export class TargetService {
  private static instance: TargetService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): TargetService {
    if (!TargetService.instance) TargetService.instance = new TargetService();
    return TargetService.instance;
  }

  public async upsert(dto: UpsertTargetDto, actor: AuthUser) {
    await this.scope.assertCanSee(actor, dto.userId);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
      select: { id: true, fullName: true, role: true },
    });
    if (!user) throw new NotFoundError('Employee not found');
    if (user.role === AppRoles.ADMIN) {
      throw new BadRequestError('Admin workspace accounts do not carry sales targets');
    }

    const medicineId = dto.medicineId ?? null;
    let medicine: { id: number; name: string } | null = null;
    if (medicineId) {
      medicine = await this.prisma.medicine.findFirst({
        where: { id: medicineId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!medicine) throw new NotFoundError('Medicine not found');
    }

    const targetMonth = parseDateOnly(`${dto.targetMonth}-01`);

    // NULL medicineId rows are distinct under the SQL unique index, so the
    // "one target per user+month+medicine" rule is enforced here, including
    // reviving a soft-deleted row instead of colliding with it.
    const existing = await this.prisma.salesTarget.findFirst({
      where: { userId: dto.userId, targetMonth, medicineId },
      orderBy: { id: 'asc' },
    });

    const row = existing
      ? await this.prisma.salesTarget.update({
          where: { id: existing.id },
          data: {
            targetAmount: new Prisma.Decimal(dto.targetAmount),
            targetUnits: dto.targetUnits ?? null,
            deletedAt: null,
            updatedBy: actor.id,
          },
        })
      : await this.prisma.salesTarget.create({
          data: {
            userId: dto.userId,
            medicineId,
            targetMonth,
            targetAmount: new Prisma.Decimal(dto.targetAmount),
            targetUnits: dto.targetUnits ?? null,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });

    await this.audits.log({
      userId: actor.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'SalesTarget',
      entityId: String(row.id),
      metadata: {
        employeeId: dto.userId,
        employee: user.fullName,
        targetMonth: dto.targetMonth,
        medicineId,
        targetAmount: dto.targetAmount,
        targetUnits: dto.targetUnits ?? null,
      },
    });

    return this.toPublic({ ...row, user, medicine });
  }

  public async list(query: ListTargetsQueryDto, actor: AuthUser) {
    const filter = await this.scope.resolveMrFilter(actor, query.userId);
    const rows = await this.prisma.salesTarget.findMany({
      where: {
        deletedAt: null,
        ...(filter.mrId ? { userId: filter.mrId } : {}),
        ...(filter.mrIds ? { userId: { in: filter.mrIds } } : {}),
        ...(query.month ? { targetMonth: parseDateOnly(`${query.month}-01`) } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        medicine: { select: { id: true, name: true } },
      },
      orderBy: [{ targetMonth: 'desc' }, { userId: 'asc' }, { medicineId: 'asc' }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  public async remove(id: number, actor: AuthUser): Promise<void> {
    const target = await this.prisma.salesTarget.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { fullName: true } } },
    });
    if (!target) throw new NotFoundError('Target not found');
    await this.scope.assertCanSee(actor, target.userId);

    await this.prisma.salesTarget.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audits.log({
      userId: actor.id,
      action: 'DELETE',
      entity: 'SalesTarget',
      entityId: String(id),
      metadata: {
        employeeId: target.userId,
        employee: target.user.fullName,
        targetMonth: formatDateOnly(target.targetMonth).slice(0, 7),
        medicineId: target.medicineId,
        targetAmount: Number(target.targetAmount),
      },
    });
  }

  /**
   * Per-MR progress for a month: overall target (medicineId null) vs the sum of
   * live sales booked in that month. A plain `sales:own` holder only reads self.
   */
  public async progress(query: TargetProgressQueryDto, actor: AuthUser) {
    const month = query.month ?? toLocalDateString().slice(0, 7);
    const monthStart = parseDateOnly(`${month}-01`);
    const { end: monthEnd } = monthRange(monthStart);

    const canManage = (actor.permissions ?? []).includes('targets:manage');
    let userIds: number[] | undefined;
    if (!canManage) {
      if (query.userId && query.userId !== actor.id) {
        throw new ForbiddenError('You can only view your own target progress');
      }
      userIds = [actor.id];
    } else {
      const filter = await this.scope.resolveMrFilter(actor, query.userId);
      userIds = filter.mrId ? [filter.mrId] : filter.mrIds;
    }

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(userIds
          ? { id: { in: userIds } }
          : { role: { in: [AppRoles.MANAGER, AppRoles.MR] } }),
      },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    const ids = users.map((user) => user.id);

    const [targets, achievedRows] = await Promise.all([
      this.prisma.salesTarget.findMany({
        where: { deletedAt: null, targetMonth: monthStart, medicineId: null, userId: { in: ids } },
      }),
      this.prisma.sale.groupBy({
        by: ['mrId'],
        where: {
          deletedAt: null,
          mrId: { in: ids },
          invoiceDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
    ]);
    const targetByUser = new Map(targets.map((target) => [target.userId, target]));
    const achievedByUser = new Map(
      achievedRows.map((row) => [row.mrId, round2(Number(row._sum.amount ?? 0))]),
    );

    const rows = users
      .filter((user) => user.role !== AppRoles.ADMIN)
      .map((user) => {
        const target = targetByUser.get(user.id);
        const targetAmount = target ? Number(target.targetAmount) : 0;
        const achievedAmount = achievedByUser.get(user.id) ?? 0;
        return {
          userId: user.id,
          fullName: user.fullName,
          role: user.role,
          targetId: target?.id ?? null,
          targetAmount,
          targetUnits: target?.targetUnits ?? null,
          achievedAmount,
          pct: targetAmount > 0 ? round2((achievedAmount / targetAmount) * 100) : null,
        };
      });

    const totals = rows.reduce(
      (acc, row) => ({
        targetAmount: round2(acc.targetAmount + row.targetAmount),
        achievedAmount: round2(acc.achievedAmount + row.achievedAmount),
      }),
      { targetAmount: 0, achievedAmount: 0 },
    );

    return {
      month,
      rows,
      totals: {
        ...totals,
        pct:
          totals.targetAmount > 0
            ? round2((totals.achievedAmount / totals.targetAmount) * 100)
            : null,
      },
    };
  }

  private toPublic(row: {
    id: number;
    userId: number;
    medicineId: number | null;
    targetMonth: Date;
    targetAmount: Prisma.Decimal | number;
    targetUnits: number | null;
    user: { id: number; fullName: string; role: string } | null;
    medicine: { id: number; name: string } | null;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      user: row.user,
      medicineId: row.medicineId,
      medicine: row.medicine,
      targetMonth: formatDateOnly(row.targetMonth).slice(0, 7),
      targetAmount: Number(row.targetAmount),
      targetUnits: row.targetUnits,
    };
  }
}
