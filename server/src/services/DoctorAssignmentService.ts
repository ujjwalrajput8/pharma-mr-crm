import type { Prisma } from '@prisma/client';
import { AppRoles, UserStatuses } from '../constants';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { formatDateOnly, monthRange, todayDateOnly } from '../utils/datetime';
import { AuditService } from './AuditService';
import { TeamScopeService } from './TeamScopeService';

type Tx = Prisma.TransactionClient;
type Db = Tx | ReturnType<typeof PrismaService.getClient>;

const OPEN_APPOINTMENT = ['PENDING', 'RESCHEDULED', 'REQUESTED', 'CONFIRMED'] as const;

export interface MrBrief {
  id: number;
  fullName: string;
  employeeCode: string | null;
  /** Reporting line above the MR, e.g. "Amit Kumar (Area Sales Manager) → Vikram Rao". */
  team: string;
}

/** One doctor that would change hands — what the confirmation dialog shows. */
export interface AssignmentMove {
  doctorId: number;
  doctorName: string;
  from: MrBrief;
  to: MrBrief | null;
  /** Stay with `from` — nothing is moved, cancelled or deleted. */
  pendingAppointments: number;
  planCalls: number;
  visits: number;
}

export type AssignmentSource = 'DOCTOR_EDIT' | 'BULK_ASSIGN' | 'VISIT_REVIEW';

/**
 * DoctorAssignmentService — the one place a doctor changes MR.
 *
 * - Taking a doctor from one MR to another (or off an MR) needs `confirmMove`;
 *   without it the server answers 409 with what would change.
 * - A Manager may only move doctors between MRs of their own team; Admin anywhere.
 * - Old visits, appointments and tour plans keep their MR. The old assignment row is
 *   ended (isActive = false), never deleted.
 * - Every change is audited with the old and new MR and their reporting lines, in the
 *   same transaction as the change.
 */
export class DoctorAssignmentService {
  private static instance: DoctorAssignmentService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly audits = AuditService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): DoctorAssignmentService {
    if (!DoctorAssignmentService.instance) {
      DoctorAssignmentService.instance = new DoctorAssignmentService();
    }
    return DoctorAssignmentService.instance;
  }

  /**
   * Assign `doctorIds` to `mrId` (null = take them off their MR).
   * `alsoInTx` lets the caller write its own rows in the same transaction.
   */
  public async assign(
    params: {
      doctorIds: number[];
      mrId: number | null;
      actor: AuthUser;
      confirmMove?: boolean;
      note?: string;
      source: AssignmentSource;
      visitId?: number;
    },
    alsoInTx?: (tx: Tx) => Promise<void>,
  ): Promise<{ changed: number; moves: AssignmentMove[] }> {
    const doctorIds = [...new Set(params.doctorIds)];
    if (doctorIds.length === 0) throw new BadRequestError('Choose at least one doctor');

    const target = params.mrId ? await this.requireAssignableMr(params.mrId) : null;
    const doctors = await this.prisma.doctor.findMany({
      where: { id: { in: doctorIds }, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (doctors.length !== doctorIds.length) throw new NotFoundError('Doctor not found');
    const doctorName = new Map(doctors.map((d) => [d.id, d.fullName]));

    const current = await this.prisma.doctorAssignment.findMany({
      where: { doctorId: { in: doctorIds }, isActive: true, deletedAt: null },
      select: { doctorId: true, mrId: true },
    });
    const currentMr = new Map(current.map((row) => [row.doctorId, row.mrId]));

    if (params.actor.role === AppRoles.MANAGER) {
      const team = new Set((await this.scope.visibleUserIds(params.actor)) ?? []);
      if (target && !team.has(target.id)) {
        throw new ForbiddenError(`${target.fullName} is not in your team`);
      }
      for (const id of doctorIds) {
        const from = currentMr.get(id);
        if (from != null && from !== target?.id && !team.has(from)) {
          throw new ForbiddenError(
            `${doctorName.get(id)} belongs to another team — only an Admin can move this doctor`,
          );
        }
      }
    } else if (params.actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('You cannot change doctor assignments');
    }

    const changing = doctorIds.filter((id) => (currentMr.get(id) ?? null) !== (target?.id ?? null));
    if (changing.length === 0) return { changed: 0, moves: [] };

    const briefs = await this.briefs([...new Set([...changing.map((id) => currentMr.get(id)), target?.id])]);
    const moves: AssignmentMove[] = [];
    for (const id of changing) {
      const from = currentMr.get(id);
      if (from == null) continue;
      moves.push({
        doctorId: id,
        doctorName: doctorName.get(id) ?? `Doctor ${id}`,
        from: briefs.get(from)!,
        to: target ? briefs.get(target.id)! : null,
        ...(await this.impact(id, from)),
      });
    }
    if (moves.length > 0 && !params.confirmMove) {
      throw new ConflictError(
        moves.length === 1
          ? `${moves[0]!.doctorName} is with ${moves[0]!.from.fullName} — confirm the move`
          : `${moves.length} doctors already have an MR — confirm the move`,
        { code: 'CONFIRM_MOVE', moves },
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        await tx.doctorAssignment.updateMany({
          where: { doctorId: { in: changing }, isActive: true, deletedAt: null },
          data: { isActive: false, unassignedAt: now, updatedBy: params.actor.id },
        });
        if (target) {
          await tx.doctorAssignment.createMany({
            data: changing.map((doctorId) => ({
              doctorId,
              mrId: target.id,
              isActive: true,
              createdBy: params.actor.id,
              updatedBy: params.actor.id,
            })),
            skipDuplicates: true,
          });
          // A pair from an earlier, ended assignment was skipped above — bring it back.
          await tx.doctorAssignment.updateMany({
            where: { doctorId: { in: changing }, mrId: target.id },
            data: { isActive: true, unassignedAt: null, assignedAt: now, deletedAt: null, updatedBy: params.actor.id },
          });
        }
        for (const id of changing) {
          const from = currentMr.get(id) ?? null;
          await this.audits.log(
            {
              userId: params.actor.id,
              action: from && target ? 'DOCTOR_REASSIGNED' : target ? 'DOCTOR_ASSIGNED' : 'DOCTOR_UNASSIGNED',
              entity: 'Doctor',
              entityId: String(id),
              before: from ? this.auditMr(briefs.get(from)!) : { mrId: null },
              after: target ? this.auditMr(briefs.get(target.id)!) : { mrId: null },
              reason: params.note || null,
              metadata: {
                doctor: doctorName.get(id) ?? null,
                source: params.source,
                ...(params.visitId ? { visitId: params.visitId } : {}),
              },
            },
            tx,
          );
        }
        if (alsoInTx) await alsoInTx(tx);
      },
      { timeout: 20_000, maxWait: 20_000 },
    );

    return { changed: changing.length, moves };
  }

  /** MRs a doctor can be given to — Manager: own team, Admin: everyone active. */
  public async mrOptions(actor: AuthUser, search?: string) {
    if (actor.role === AppRoles.MR) throw new ForbiddenError('You cannot change doctor assignments');
    const team = await this.scope.visibleUserIds(actor);
    const term = search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatuses.ACTIVE,
        role: AppRoles.MR,
        ...(team ? { id: { in: team } } : {}),
        ...(term
          ? {
              OR: [
                { fullName: { contains: term, mode: 'insensitive' } },
                { mrProfile: { employeeCode: { contains: term, mode: 'insensitive' } } },
                { mrProfile: { assignedArea: { contains: term, mode: 'insensitive' } } },
                { manager: { fullName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        territory: { select: { name: true } },
        mrProfile: { select: { employeeCode: true, assignedArea: true } },
        _count: { select: { assignedDoctors: { where: { isActive: true, deletedAt: null } } } },
      },
      orderBy: { fullName: 'asc' },
      take: 200,
    });
    const briefs = await this.briefs(users.map((u) => u.id));
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      employeeCode: u.mrProfile?.employeeCode ?? null,
      photoUrl: u.photoUrl ?? null,
      area: u.mrProfile?.assignedArea ?? u.territory?.name ?? null,
      team: briefs.get(u.id)?.team ?? '',
      doctorCount: u._count.assignedDoctors,
    }));
  }

  /** Who had the doctor, when, and who changed it (assignment rows + audit). */
  public async history(doctorId: number) {
    const [rows, audits] = await Promise.all([
      this.prisma.doctorAssignment.findMany({
        where: { doctorId },
        orderBy: { assignedAt: 'desc' },
        select: {
          mrId: true,
          isActive: true,
          assignedAt: true,
          unassignedAt: true,
          mr: { select: { fullName: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          entity: 'Doctor',
          entityId: String(doctorId),
          action: { in: ['DOCTOR_ASSIGNED', 'DOCTOR_REASSIGNED', 'DOCTOR_UNASSIGNED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          action: true,
          before: true,
          after: true,
          reason: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
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
      changes: audits.map((row) => ({
        action: row.action,
        at: row.createdAt,
        by: row.user,
        before: row.before,
        after: row.after,
        note: row.reason,
        source: (row.metadata as { source?: string } | null)?.source ?? null,
      })),
    };
  }

  private async requireAssignableMr(mrId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: mrId, deletedAt: null },
      select: { id: true, fullName: true, role: true, status: true },
    });
    if (!user || user.role !== AppRoles.MR) throw new NotFoundError('Medical Representative not found');
    if (user.status !== UserStatuses.ACTIVE) {
      throw new BadRequestError(`${user.fullName} is deactivated — choose an active MR`);
    }
    return user;
  }

  /** Name, code and the reporting line above each user (up to RSM level). */
  private async briefs(ids: Array<number | undefined>, db: Db = this.prisma): Promise<Map<number, MrBrief>> {
    const wanted = [...new Set(ids.filter((id): id is number => id != null))];
    const out = new Map<number, MrBrief>();
    if (wanted.length === 0) return out;
    const people = new Map<number, { fullName: string; managerId: number | null; designation: string | null; code: string | null }>();
    let frontier = wanted;
    for (let depth = 0; depth < 4 && frontier.length > 0; depth += 1) {
      const rows = await db.user.findMany({
        where: { id: { in: frontier } },
        select: { id: true, fullName: true, managerId: true, mrProfile: { select: { designation: true, employeeCode: true } } },
      });
      for (const row of rows) {
        people.set(row.id, {
          fullName: row.fullName,
          managerId: row.managerId,
          designation: row.mrProfile?.designation ?? null,
          code: row.mrProfile?.employeeCode ?? null,
        });
      }
      frontier = rows.map((r) => r.managerId).filter((id): id is number => id != null && !people.has(id));
    }
    for (const id of wanted) {
      const person = people.get(id);
      if (!person) continue;
      const chain: string[] = [];
      let next = person.managerId;
      for (let i = 0; i < 3 && next != null; i += 1) {
        const boss = people.get(next);
        if (!boss) break;
        chain.push(boss.designation ? `${boss.fullName} (${boss.designation})` : boss.fullName);
        next = boss.managerId;
      }
      out.set(id, { id, fullName: person.fullName, employeeCode: person.code, team: chain.join(' → ') });
    }
    return out;
  }

  private auditMr(brief: MrBrief) {
    return { mrId: brief.id, mrName: brief.fullName, employeeCode: brief.employeeCode, team: brief.team };
  }

  /** What stays with the old MR if the doctor moves — shown before confirming. */
  private async impact(doctorId: number, mrId: number) {
    const { start } = monthRange(todayDateOnly());
    const [pendingAppointments, planCalls, visits] = await Promise.all([
      this.prisma.appointment.count({
        where: { doctorId, mrId, deletedAt: null, status: { in: [...OPEN_APPOINTMENT] } },
      }),
      this.prisma.tourPlanCall.count({
        where: { doctorId, tourPlanDay: { planDate: { gte: start }, tourPlan: { userId: mrId, deletedAt: null } } },
      }),
      this.prisma.visit.count({ where: { doctorId, mrId, deletedAt: null } }),
    ]);
    return { pendingAppointments, planCalls, visits };
  }
}
