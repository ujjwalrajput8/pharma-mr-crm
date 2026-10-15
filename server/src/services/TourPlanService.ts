import type { Prisma } from '@prisma/client';
import { WorkTypes } from '../constants';
import type {
  DecideTourPlanDto,
  ListTourPlansQueryDto,
  UpsertMyTourPlanDto,
} from '../dto/tour-plan.dto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { AuditService } from './AuditService';
import { TeamScopeService } from './TeamScopeService';
import { formatDateOnly, parseDateOnly, todayDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

const dayInclude = {
  territory: { select: { id: true, name: true, type: true } },
  jointWith: { select: { id: true, fullName: true } },
  calls: {
    orderBy: { id: 'asc' },
    include: {
      doctor: {
        select: {
          id: true,
          fullName: true,
          category: true,
          specialization: true,
          phone: true,
          city: true,
        },
      },
      chemist: { select: { id: true, name: true, phone: true, city: true } },
    },
  },
} satisfies Prisma.TourPlanDayInclude;

const planInclude = {
  user: { select: { id: true, fullName: true, email: true, role: true } },
  approvedBy: { select: { id: true, fullName: true } },
  days: { orderBy: { planDate: 'asc' }, include: dayInclude },
} satisfies Prisma.TourPlanInclude;

type PlanRow = Prisma.TourPlanGetPayload<{ include: typeof planInclude }>;
type DayRow = Prisma.TourPlanDayGetPayload<{ include: typeof dayInclude }>;

export interface PublicTourPlanCall {
  id: number;
  doctor: {
    id: number;
    fullName: string;
    category: string;
    specialization: string | null;
    phone: string | null;
    city: string | null;
  } | null;
  chemist: { id: number; name: string; phone: string | null; city: string | null } | null;
}

export interface PublicTourPlanDay {
  id: number;
  planDate: string;
  workType: string;
  notes: string | null;
  territory: { id: number; name: string; type: string } | null;
  jointWith: { id: number; fullName: string } | null;
  calls: PublicTourPlanCall[];
}

export interface PublicTourPlan {
  id: number;
  userId: number;
  user: { id: number; fullName: string; email: string; role: string } | null;
  month: string;
  status: string;
  submittedAt: string | null;
  actedAt: string | null;
  remark: string | null;
  approvedBy: { id: number; fullName: string } | null;
  days: PublicTourPlanDay[];
}

export interface TourPlanListRow {
  id: number;
  user: { id: number; fullName: string; email: string; role: string } | null;
  month: string;
  status: string;
  submittedAt: string | null;
  actedAt: string | null;
  remark: string | null;
  counts: { days: number; fieldDays: number; calls: number };
}

/**
 * TourPlanService — the MTP workflow every pharma field force runs on:
 * MR drafts a month beat-wise → submits → manager approves / rejects.
 * Approved plans are read-only for the MR and feed My Day's call list.
 */
export class TourPlanService {
  private static instance: TourPlanService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): TourPlanService {
    if (!TourPlanService.instance) TourPlanService.instance = new TourPlanService();
    return TourPlanService.instance;
  }

  // ── MR: my plan ────────────────────────────────────────────────────────────

  public async getMyPlan(
    month: string,
    actor: AuthUser,
  ): Promise<{
    month: string;
    plan: PublicTourPlan | null;
    /** The actor's reporting chain — the joint-work picker on the client. */
    managers: Array<{ id: number; fullName: string; role: string }>;
  }> {
    const [row, managers] = await Promise.all([
      this.findPlan(actor.id, month),
      this.managerChain(actor.id),
    ]);
    return {
      month,
      plan: row ? this.toPublic(row) : null,
      managers: managers.map((m) => ({ id: m.id, fullName: m.fullName, role: m.role })),
    };
  }

  /**
   * Upsert the whole month draft — replace-all: every day row of the plan is
   * deleted and recreated from the payload inside one transaction.
   * Allowed only while DRAFT or REJECTED; a rejected plan drops back to DRAFT.
   */
  public async saveMyPlan(
    month: string,
    dto: UpsertMyTourPlanDto,
    actor: AuthUser,
  ): Promise<PublicTourPlan> {
    const existing = await this.prisma.tourPlan.findFirst({
      where: { userId: actor.id, planMonth: parseDateOnly(`${month}-01`), deletedAt: null },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new BadRequestError(
        `This plan is ${existing.status.toLowerCase()} — it can no longer be edited.`,
      );
    }

    await this.validateDays(month, dto, actor);

    const planMonth = parseDateOnly(`${month}-01`);
    const planId = await this.prisma.$transaction(async (tx) => {
      const plan = existing
        ? await tx.tourPlan.update({
            where: { id: existing.id },
            data: {
              status: 'DRAFT',
              submittedAt: null,
              approvedById: null,
              actedAt: null,
              remark: null,
              updatedBy: actor.id,
            },
          })
        : await tx.tourPlan.create({
            data: {
              userId: actor.id,
              planMonth,
              status: 'DRAFT',
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          });

      // Replace-all: calls cascade with their day rows.
      await tx.tourPlanDay.deleteMany({ where: { tourPlanId: plan.id } });
      for (const day of dto.days) {
        await tx.tourPlanDay.create({
          data: {
            tourPlanId: plan.id,
            planDate: parseDateOnly(day.planDate),
            territoryId: day.territoryId ?? null,
            workType: day.workType,
            jointWithUserId: day.jointWithUserId ?? null,
            notes: day.notes ?? null,
            calls: {
              create: day.calls.map((call) => ({
                doctorId: call.doctorId ?? null,
                chemistId: call.chemistId ?? null,
              })),
            },
          },
        });
      }
      return plan.id;
    });

    const saved = await this.prisma.tourPlan.findUniqueOrThrow({
      where: { id: planId },
      include: planInclude,
    });
    return this.toPublic(saved);
  }

  public async submitMyPlan(month: string, actor: AuthUser): Promise<PublicTourPlan> {
    const row = await this.findPlan(actor.id, month);
    if (!row) throw new NotFoundError('No plan drafted for this month yet');
    if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
      throw new BadRequestError(`This plan is already ${row.status.toLowerCase()}`);
    }

    const fieldDays = row.days.filter((day) => day.workType === WorkTypes.FIELD).length;
    if (fieldDays === 0) {
      throw new BadRequestError('Plan at least one FIELD day before submitting');
    }

    const updated = await this.prisma.tourPlan.update({
      where: { id: row.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        approvedById: null,
        actedAt: null,
        remark: null,
        updatedBy: actor.id,
      },
      include: planInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'SUBMIT_TOUR_PLAN',
      entity: 'TourPlan',
      entityId: String(row.id),
      metadata: { month, days: row.days.length, fieldDays },
    });

    return this.toPublic(updated);
  }

  // ── Manager: team plans ────────────────────────────────────────────────────

  public async listTeam(query: ListTourPlansQueryDto, actor: AuthUser): Promise<TourPlanListRow[]> {
    const filter = await this.scope.resolveMrFilter(actor, query.userId);

    const rows = await this.prisma.tourPlan.findMany({
      where: {
        deletedAt: null,
        ...(filter.mrId ? { userId: filter.mrId } : {}),
        ...(filter.mrIds ? { userId: { in: filter.mrIds } } : {}),
        ...(query.month ? { planMonth: parseDateOnly(`${query.month}-01`) } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        days: { select: { workType: true, _count: { select: { calls: true } } } },
      },
      orderBy: [{ planMonth: 'desc' }, { submittedAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });

    return rows.map((row) => ({
      id: row.id,
      user: row.user,
      month: formatDateOnly(row.planMonth).slice(0, 7),
      status: row.status,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      actedAt: row.actedAt?.toISOString() ?? null,
      remark: row.remark,
      counts: {
        days: row.days.length,
        fieldDays: row.days.filter((day) => day.workType === WorkTypes.FIELD).length,
        calls: row.days.reduce((sum, day) => sum + day._count.calls, 0),
      },
    }));
  }

  public async getById(id: number, actor: AuthUser): Promise<PublicTourPlan> {
    const row = await this.prisma.tourPlan.findFirst({
      where: { id, deletedAt: null },
      include: planInclude,
    });
    if (!row) throw new NotFoundError('Tour plan not found');
    await this.scope.assertCanSee(actor, row.userId);
    return this.toPublic(row);
  }

  public async decide(
    id: number,
    dto: DecideTourPlanDto,
    actor: AuthUser,
  ): Promise<PublicTourPlan> {
    const row = await this.prisma.tourPlan.findFirst({
      where: { id, deletedAt: null },
      include: planInclude,
    });
    if (!row) throw new NotFoundError('Tour plan not found');
    if (row.userId === actor.id) {
      throw new ForbiddenError('You cannot approve your own tour plan');
    }
    await this.scope.assertCanSee(actor, row.userId);
    if (row.status !== 'SUBMITTED') {
      throw new BadRequestError(`Only a submitted plan can be decided — this one is ${row.status.toLowerCase()}`);
    }

    const updated = await this.prisma.tourPlan.update({
      where: { id },
      data: {
        status: dto.status,
        approvedById: actor.id,
        actedAt: new Date(),
        remark: dto.remark ?? null,
        updatedBy: actor.id,
      },
      include: planInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'DECIDE_TOUR_PLAN',
      entity: 'TourPlan',
      entityId: String(id),
      metadata: {
        status: dto.status,
        remark: dto.remark ?? null,
        employeeId: row.userId,
        employee: row.user?.fullName ?? null,
        month: formatDateOnly(row.planMonth).slice(0, 7),
      },
    });

    return this.toPublic(updated);
  }

  // ── My Day feed ────────────────────────────────────────────────────────────

  /** Today's day from the actor's APPROVED plan — null when nothing is planned. */
  public async todayForActor(actor: AuthUser): Promise<PublicTourPlanDay | null> {
    const today = todayDateOnly();
    const monthAnchor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const day = await this.prisma.tourPlanDay.findFirst({
      where: {
        planDate: today,
        tourPlan: {
          userId: actor.id,
          planMonth: monthAnchor,
          status: 'APPROVED',
          deletedAt: null,
        },
      },
      include: dayInclude,
    });
    return day ? this.toPublicDay(day) : null;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private findPlan(userId: number, month: string): Promise<PlanRow | null> {
    return this.prisma.tourPlan.findFirst({
      where: { userId, planMonth: parseDateOnly(`${month}-01`), deletedAt: null },
      include: planInclude,
    });
  }

  /** Reporting chain above a user (manager, their manager …), cycle-safe. */
  private async managerChain(
    userId: number,
  ): Promise<Array<{ id: number; fullName: string; role: string }>> {
    const chain: Array<{ id: number; fullName: string; role: string }> = [];
    const seen = new Set<number>([userId]);
    let cursor: number | null = userId;

    for (let depth = 0; depth < 6 && cursor; depth += 1) {
      const user: { managerId: number | null } | null = await this.prisma.user.findFirst({
        where: { id: cursor, deletedAt: null },
        select: { managerId: true },
      });
      const managerId: number | null = user?.managerId ?? null;
      if (!managerId || seen.has(managerId)) break;
      seen.add(managerId);
      const manager: { id: number; fullName: string; role: string } | null =
        await this.prisma.user.findFirst({
          where: { id: managerId, deletedAt: null, status: 'ACTIVE' },
          select: { id: true, fullName: true, role: true },
        });
      if (!manager) break;
      chain.push(manager);
      cursor = manager.id;
    }
    return chain;
  }

  private async validateDays(
    month: string,
    dto: UpsertMyTourPlanDto,
    actor: AuthUser,
  ): Promise<void> {
    const seenDates = new Set<string>();
    for (const day of dto.days) {
      if (!day.planDate.startsWith(`${month}-`)) {
        throw new BadRequestError(`${day.planDate} is outside ${month}`);
      }
      if (seenDates.has(day.planDate)) {
        throw new BadRequestError(`${day.planDate} appears twice in the plan`);
      }
      seenDates.add(day.planDate);

      const fieldLike = day.workType === WorkTypes.FIELD || day.workType === WorkTypes.JOINT_WORK;
      if (!fieldLike && day.calls.length > 0) {
        throw new BadRequestError(
          `${day.planDate}: calls can only be planned on FIELD or JOINT_WORK days`,
        );
      }
    }

    // Beats/HQs only — a plan day is beat-wise, never a whole district.
    const territoryIds = [...new Set(dto.days.flatMap((d) => (d.territoryId ? [d.territoryId] : [])))];
    if (territoryIds.length > 0) {
      const territories = await this.prisma.territory.findMany({
        where: { id: { in: territoryIds }, deletedAt: null },
        select: { id: true, name: true, type: true },
      });
      const byId = new Map(territories.map((t) => [t.id, t]));
      for (const tid of territoryIds) {
        const territory = byId.get(tid);
        if (!territory) throw new BadRequestError(`Territory ${tid} not found`);
        if (territory.type !== 'BEAT' && territory.type !== 'HQ') {
          throw new BadRequestError(
            `${territory.name} is a ${territory.type} — plan days against a BEAT or HQ`,
          );
        }
      }
    }

    // Joint work must be with someone in the actor's own reporting chain.
    const jointIds = [...new Set(dto.days.flatMap((d) => (d.jointWithUserId ? [d.jointWithUserId] : [])))];
    if (jointIds.length > 0) {
      const chain = await this.managerChain(actor.id);
      const chainIds = new Set(chain.map((m) => m.id));
      for (const jointId of jointIds) {
        if (!chainIds.has(jointId)) {
          throw new BadRequestError(
            'Joint work can only be planned with your manager or a manager above them',
          );
        }
      }
    }

    // Validate referenced doctors / chemists exist (a clean 400 beats an FK error).
    const doctorIds = [
      ...new Set(dto.days.flatMap((d) => d.calls.flatMap((c) => (c.doctorId ? [c.doctorId] : [])))),
    ];
    if (doctorIds.length > 0) {
      const found = await this.prisma.doctor.findMany({
        where: { id: { in: doctorIds }, deletedAt: null },
        select: { id: true },
      });
      const foundIds = new Set(found.map((d) => d.id));
      const missing = doctorIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) throw new BadRequestError(`Doctor ${missing[0]} not found`);
    }
    const chemistIds = [
      ...new Set(dto.days.flatMap((d) => d.calls.flatMap((c) => (c.chemistId ? [c.chemistId] : [])))),
    ];
    if (chemistIds.length > 0) {
      const found = await this.prisma.medicalStore.findMany({
        where: { id: { in: chemistIds }, deletedAt: null },
        select: { id: true },
      });
      const foundIds = new Set(found.map((s) => s.id));
      const missing = chemistIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) throw new BadRequestError(`Chemist ${missing[0]} not found`);
    }
  }

  private toPublicDay(day: DayRow): PublicTourPlanDay {
    return {
      id: day.id,
      planDate: formatDateOnly(day.planDate),
      workType: day.workType,
      notes: day.notes,
      territory: day.territory,
      jointWith: day.jointWith,
      calls: day.calls.map((call) => ({
        id: call.id,
        doctor: call.doctor
          ? {
              id: call.doctor.id,
              fullName: call.doctor.fullName,
              category: call.doctor.category,
              specialization: call.doctor.specialization,
              phone: call.doctor.phone,
              city: call.doctor.city,
            }
          : null,
        chemist: call.chemist
          ? {
              id: call.chemist.id,
              name: call.chemist.name,
              phone: call.chemist.phone,
              city: call.chemist.city,
            }
          : null,
      })),
    };
  }

  private toPublic(row: PlanRow): PublicTourPlan {
    return {
      id: row.id,
      userId: row.userId,
      user: row.user,
      month: formatDateOnly(row.planMonth).slice(0, 7),
      status: row.status,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      actedAt: row.actedAt?.toISOString() ?? null,
      remark: row.remark,
      approvedBy: row.approvedBy,
      days: row.days.map((day) => this.toPublicDay(day)),
    };
  }
}
