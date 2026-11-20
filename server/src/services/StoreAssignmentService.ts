import type { ChemistType } from '@prisma/client';
import { AppRoles } from '../constants';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { formatDateOnly, monthRange, todayDateOnly } from '../utils/datetime';
import { AuditService } from './AuditService';
import { DoctorAssignmentService, type MrBrief } from './DoctorAssignmentService';
import { TeamScopeService } from './TeamScopeService';

/** One chemist / stockist that would change hands — what the confirmation dialog shows. */
export interface StoreMove {
  storeId: number;
  storeName: string;
  type: ChemistType;
  from: MrBrief;
  to: MrBrief | null;
  /** Stays with `from` — nothing is moved or deleted. */
  planCalls: number;
}

/**
 * StoreAssignmentService — puts a chemist / stockist in an MR's MSL list (M2.1).
 * Same rules as doctors: a move from one MR to another needs `confirmMove` (409 with
 * what changes otherwise), a Manager works inside their own team, the old row is
 * ended (never deleted) and every change is audited in the same transaction.
 */
export class StoreAssignmentService {
  private static instance: StoreAssignmentService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly audits = AuditService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly doctors = DoctorAssignmentService.getInstance(),
  ) {}

  public static getInstance(): StoreAssignmentService {
    if (!StoreAssignmentService.instance) {
      StoreAssignmentService.instance = new StoreAssignmentService();
    }
    return StoreAssignmentService.instance;
  }

  /** Assign `storeIds` to `mrId` (null = take them off their MR). */
  public async assign(params: {
    storeIds: number[];
    mrId: number | null;
    actor: AuthUser;
    confirmMove?: boolean;
    note?: string;
  }): Promise<{ changed: number; mr: { id: number; fullName: string } | null }> {
    const storeIds = [...new Set(params.storeIds)];
    if (storeIds.length === 0) throw new BadRequestError('Choose at least one chemist or stockist');

    const target = params.mrId ? await this.doctors.requireAssignableMr(params.mrId) : null;
    const stores = await this.prisma.medicalStore.findMany({
      where: { id: { in: storeIds }, deletedAt: null },
      select: { id: true, name: true, type: true },
    });
    if (stores.length !== storeIds.length) throw new NotFoundError('Chemist / stockist not found');
    const store = new Map(stores.map((s) => [s.id, s]));

    const current = await this.prisma.storeAssignment.findMany({
      where: { storeId: { in: storeIds }, isActive: true, deletedAt: null },
      select: { storeId: true, mrId: true },
    });
    const currentMr = new Map(current.map((row) => [row.storeId, row.mrId]));

    if (params.actor.role === AppRoles.MANAGER) {
      const team = new Set((await this.scope.visibleUserIds(params.actor)) ?? []);
      if (target && !team.has(target.id)) throw new ForbiddenError(`${target.fullName} is not in your team`);
      for (const id of storeIds) {
        const from = currentMr.get(id);
        if (from != null && from !== target?.id && !team.has(from)) {
          throw new ForbiddenError(`${store.get(id)?.name} belongs to another team — only an Admin can move it`);
        }
      }
    } else if (params.actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('You cannot change chemist / stockist assignments');
    }

    const changing = storeIds.filter((id) => (currentMr.get(id) ?? null) !== (target?.id ?? null));
    if (changing.length === 0) return { changed: 0, mr: target ? { id: target.id, fullName: target.fullName } : null };

    const briefs = await this.doctors.briefs([...new Set([...changing.map((id) => currentMr.get(id)), target?.id])]);
    const moves: StoreMove[] = [];
    for (const id of changing) {
      const from = currentMr.get(id);
      if (from == null) continue;
      moves.push({
        storeId: id,
        storeName: store.get(id)?.name ?? `Store ${id}`,
        type: store.get(id)?.type ?? 'CHEMIST',
        from: briefs.get(from)!,
        to: target ? briefs.get(target.id)! : null,
        planCalls: await this.planCalls(id, from),
      });
    }
    if (moves.length > 0 && !params.confirmMove) {
      throw new ConflictError(
        moves.length === 1
          ? `${moves[0]!.storeName} is with ${moves[0]!.from.fullName} — confirm the move`
          : `${moves.length} chemists / stockists already have an MR — confirm the move`,
        { code: 'CONFIRM_MOVE', moves },
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        await tx.storeAssignment.updateMany({
          where: { storeId: { in: changing }, isActive: true, deletedAt: null },
          data: { isActive: false, unassignedAt: now, updatedBy: params.actor.id },
        });
        if (target) {
          await tx.storeAssignment.createMany({
            data: changing.map((storeId) => ({ storeId, mrId: target.id, createdBy: params.actor.id, updatedBy: params.actor.id })),
            skipDuplicates: true,
          });
          // A pair from an earlier, ended assignment was skipped above — bring it back.
          await tx.storeAssignment.updateMany({
            where: { storeId: { in: changing }, mrId: target.id },
            data: { isActive: true, unassignedAt: null, assignedAt: now, deletedAt: null, updatedBy: params.actor.id },
          });
        }
        for (const id of changing) {
          const from = currentMr.get(id) ?? null;
          const audit = (brief: MrBrief) => ({ mrId: brief.id, mrName: brief.fullName, employeeCode: brief.employeeCode, team: brief.team });
          await this.audits.log(
            {
              userId: params.actor.id,
              action: from && target ? 'STORE_REASSIGNED' : target ? 'STORE_ASSIGNED' : 'STORE_UNASSIGNED',
              entity: 'MedicalStore',
              entityId: String(id),
              before: from ? audit(briefs.get(from)!) : { mrId: null },
              after: target ? audit(briefs.get(target.id)!) : { mrId: null },
              reason: params.note || null,
              metadata: { store: store.get(id)?.name ?? null, type: store.get(id)?.type ?? null },
            },
            tx,
          );
        }
      },
      { timeout: 20_000, maxWait: 20_000 },
    );

    return { changed: changing.length, mr: target ? { id: target.id, fullName: target.fullName } : null };
  }

  /** The signed-in MR's chemists / stockists (MSL list). */
  public async mine(actor: AuthUser, type?: ChemistType) {
    const rows = await this.prisma.storeAssignment.findMany({
      where: {
        mrId: actor.id,
        isActive: true,
        deletedAt: null,
        store: { deletedAt: null, ...(type ? { type } : {}) },
      },
      orderBy: { store: { name: 'asc' } },
      select: {
        assignedAt: true,
        store: {
          select: {
            id: true,
            name: true,
            type: true,
            ownerName: true,
            phone: true,
            addressLine1: true,
            city: true,
            status: true,
            territory: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      ...row.store,
      territory: row.store.territory?.name ?? null,
      since: formatDateOnly(row.assignedAt),
    }));
  }

  /** Who had the chemist / stockist, when, and who changed it. */
  public async history(storeId: number) {
    const [rows, audits] = await Promise.all([
      this.prisma.storeAssignment.findMany({
        where: { storeId },
        orderBy: { assignedAt: 'desc' },
        select: { mrId: true, isActive: true, assignedAt: true, unassignedAt: true, mr: { select: { fullName: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { entity: 'MedicalStore', entityId: String(storeId), action: { in: ['STORE_ASSIGNED', 'STORE_REASSIGNED', 'STORE_UNASSIGNED'] } },
        orderBy: { createdAt: 'desc' },
        select: { action: true, before: true, after: true, reason: true, createdAt: true, user: { select: { id: true, fullName: true } } },
      }),
    ]);
    return {
      assignments: rows.map((row) => ({
        mrId: row.mrId,
        mrName: row.mr.fullName,
        active: row.isActive,
        from: formatDateOnly(row.assignedAt),
        to: row.unassignedAt ? formatDateOnly(row.unassignedAt) : null,
      })),
      changes: audits.map((row) => ({ action: row.action, at: row.createdAt, by: row.user, before: row.before, after: row.after, note: row.reason })),
    };
  }

  /** Tour plan calls this month that stay with the old MR if the store moves. */
  private planCalls(storeId: number, mrId: number) {
    const { start } = monthRange(todayDateOnly());
    return this.prisma.tourPlanCall.count({
      where: { chemistId: storeId, tourPlanDay: { planDate: { gte: start }, tourPlan: { userId: mrId, deletedAt: null } } },
    });
  }
}
