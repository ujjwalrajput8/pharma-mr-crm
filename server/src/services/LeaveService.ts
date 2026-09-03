import { AppRoles, LeaveDayParts, LeaveStatuses } from '../constants';
import type {
  ApplyLeaveDto,
  CancelLeaveDto,
  DecideLeaveDto,
  GrantCompOffDto,
  LeaveBalanceQueryDto,
  ListLeavesQueryDto,
  SetLeaveBalanceDto,
  UpdateLeaveTypeDto,
  UpsertLeaveTypeDto,
} from '../dto/leave.dto';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import { LeaveRepository, type LeaveRequestRow } from '../repositories/LeaveRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { AuditService } from './AuditService';
import { HolidayService } from './HolidayService';
import { TeamScopeService } from './TeamScopeService';
import {
  currentYear,
  eachDayInclusive,
  formatDateOnly,
  isSunday,
  parseDateOnly,
  todayDateOnly,
} from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

export interface PublicLeaveRequest {
  id: number;
  userId: number;
  employee: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    employeeCode: string | null;
    designation: string | null;
  } | null;
  leaveType: { id: number; code: string; name: string; colorHex: string; isPaid: boolean } | null;
  fromDate: string;
  toDate: string;
  dayPart: string;
  days: number;
  reason: string;
  contactPhone: string | null;
  attachmentUrl: string | null;
  status: string;
  decisionRemark: string | null;
  actedAt: string | null;
  approvedBy: { id: number; fullName: string; role: string } | null;
  createdAt: string;
}

export interface PublicLeaveBalance {
  leaveTypeId: number;
  code: string;
  name: string;
  colorHex: string;
  isPaid: boolean;
  allowHalfDay: boolean;
  requiresProof: boolean;
  opening: number;
  allocated: number;
  /** opening + allocated */
  entitled: number;
  used: number;
  pending: number;
  /** entitled − used (pending is shown separately so the employee can see both) */
  remaining: number;
  unlimited: boolean;
}

/**
 * LeaveService — apply → approve → attendance + balance.
 *
 * Rules that matter:
 *  - Working days only: Sundays and non-optional holidays are not consumed.
 *  - One live request per date range: PENDING/APPROVED requests may not overlap.
 *  - Balance is a derived number: `used` is always recomputed from APPROVED requests.
 *  - Approval writes the attendance rows (status LEAVE, workType LEAVE) so the
 *    attendance register and the leave ledger can never drift apart.
 */
export class LeaveService {
  private static instance: LeaveService | null = null;

  private constructor(
    private readonly leaves = LeaveRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly attendance = AttendanceRepository.getInstance(),
    private readonly holidays = HolidayService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): LeaveService {
    if (!LeaveService.instance) LeaveService.instance = new LeaveService();
    return LeaveService.instance;
  }

  // ── Leave types (policy master) ────────────────────────────────────────────

  public async listTypes(includeInactive = false) {
    const rows = await this.leaves.listTypes(includeInactive);
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      annualQuota: Number(row.annualQuota),
      isPaid: row.isPaid,
      carryForward: row.carryForward,
      maxCarryForward: Number(row.maxCarryForward),
      allowHalfDay: row.allowHalfDay,
      requiresProof: row.requiresProof,
      colorHex: row.colorHex,
      description: row.description,
      status: row.status,
    }));
  }

  public async createType(dto: UpsertLeaveTypeDto, actor: AuthUser) {
    const existing = await this.leaves.findTypeByCode(dto.code);
    if (existing) throw new ConflictError(`Leave type ${dto.code} already exists`);
    const row = await this.leaves.createType({
      code: dto.code,
      name: dto.name,
      annualQuota: dto.annualQuota,
      isPaid: dto.isPaid,
      carryForward: dto.carryForward,
      maxCarryForward: dto.maxCarryForward,
      allowHalfDay: dto.allowHalfDay,
      requiresProof: dto.requiresProof,
      colorHex: dto.colorHex,
      description: dto.description,
      status: dto.status,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    return { id: row.id, code: row.code, name: row.name };
  }

  public async updateType(id: number, dto: UpdateLeaveTypeDto, actor: AuthUser) {
    const existing = await this.leaves.findTypeById(id);
    if (!existing) throw new NotFoundError('Leave type not found');

    if (dto.code && dto.code !== existing.code) {
      const clash = await this.leaves.findTypeByCode(dto.code);
      if (clash) throw new ConflictError(`Leave type ${dto.code} already exists`);
    }

    const row = await this.leaves.updateType(id, {
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.annualQuota !== undefined ? { annualQuota: dto.annualQuota } : {}),
      ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
      ...(dto.carryForward !== undefined ? { carryForward: dto.carryForward } : {}),
      ...(dto.maxCarryForward !== undefined ? { maxCarryForward: dto.maxCarryForward } : {}),
      ...(dto.allowHalfDay !== undefined ? { allowHalfDay: dto.allowHalfDay } : {}),
      ...(dto.requiresProof !== undefined ? { requiresProof: dto.requiresProof } : {}),
      ...(dto.colorHex !== undefined ? { colorHex: dto.colorHex } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updatedBy: actor.id,
    });
    return { id: row.id, code: row.code, name: row.name };
  }

  public async removeType(id: number, actor: AuthUser): Promise<void> {
    const existing = await this.leaves.findTypeById(id);
    if (!existing) throw new NotFoundError('Leave type not found');
    const used = await this.leaves.countRequestsForType(id);
    if (used > 0) {
      throw new BadRequestError(
        `${used} leave request(s) use this type — set it to Inactive instead of deleting.`,
      );
    }
    await this.leaves.softDeleteType(id, actor.id);
  }

  // ── Requests ───────────────────────────────────────────────────────────────

  public async list(query: ListLeavesQueryDto, actor: AuthUser) {
    const userFilter = await this.resolveUserFilter(actor, query.userId);
    const year = query.year;
    const { items, total } = await this.leaves.listRequests({
      page: query.page,
      limit: query.limit,
      ...userFilter,
      leaveTypeId: query.leaveTypeId,
      status: query.status,
      from: query.from
        ? parseDateOnly(query.from)
        : year
          ? new Date(Date.UTC(year, 0, 1))
          : undefined,
      to: query.to ? parseDateOnly(query.to) : year ? new Date(Date.UTC(year, 11, 31)) : undefined,
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

  public async getById(id: number, actor: AuthUser): Promise<PublicLeaveRequest> {
    const row = await this.leaves.findRequestById(id);
    if (!row) throw new NotFoundError('Leave request not found');
    await this.scope.assertCanSee(actor, row.userId);
    return this.toPublic(row);
  }

  public async apply(dto: ApplyLeaveDto, actor: AuthUser): Promise<PublicLeaveRequest> {
    const targetUserId = dto.userId ?? actor.id;
    if (targetUserId !== actor.id) {
      if (actor.role === AppRoles.MR) {
        throw new ForbiddenError('You can only apply for your own leave');
      }
      await this.scope.assertCanSee(actor, targetUserId);
    }

    const target = await this.users.findById(targetUserId);
    if (!target || target.deletedAt) throw new NotFoundError('Employee not found');
    if (target.role === AppRoles.ADMIN) {
      throw new BadRequestError('Admin workspace accounts do not track leave');
    }

    const leaveType = await this.leaves.findTypeById(dto.leaveTypeId);
    if (!leaveType || leaveType.status !== 'ACTIVE') {
      throw new BadRequestError('Select an active leave type');
    }
    if (dto.dayPart !== LeaveDayParts.FULL && !leaveType.allowHalfDay) {
      throw new BadRequestError(`${leaveType.name} cannot be taken as a half day`);
    }
    if (leaveType.requiresProof && !dto.attachmentUrl) {
      throw new BadRequestError(`${leaveType.name} needs a supporting document`);
    }

    const fromDate = parseDateOnly(dto.fromDate);
    const toDate = parseDateOnly(dto.toDate);

    const overlaps = await this.leaves.findOverlapping({ userId: targetUserId, fromDate, toDate });
    const clash = overlaps[0];
    if (clash) {
      throw new ConflictError(
        `Overlaps an existing ${clash.leaveType.code} request (${formatDateOnly(clash.fromDate)} → ${formatDateOnly(clash.toDate)})`,
      );
    }

    const days = await this.countWorkingDays(fromDate, toDate, dto.dayPart, target.territoryId);
    if (days <= 0) {
      throw new BadRequestError(
        'That range has no working days — it is all weekly offs or holidays.',
      );
    }

    // Paid, quota-bound types are checked against the remaining balance.
    if (leaveType.isPaid && Number(leaveType.annualQuota) > 0) {
      const balances = await this.balancesFor(targetUserId, fromDate.getUTCFullYear());
      const balance = balances.find((b) => b.leaveTypeId === leaveType.id);
      if (balance && days > balance.remaining - balance.pending) {
        throw new BadRequestError(
          `Only ${(balance.remaining - balance.pending).toFixed(1)} day(s) of ${leaveType.code} left (this request needs ${days}).`,
        );
      }
    }

    const row = await this.leaves.createRequest({
      user: { connect: { id: targetUserId } },
      leaveType: { connect: { id: leaveType.id } },
      fromDate,
      toDate,
      dayPart: dto.dayPart,
      days,
      reason: dto.reason,
      contactPhone: dto.contactPhone,
      attachmentUrl: dto.attachmentUrl,
      status: LeaveStatuses.PENDING,
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    return this.toPublic(row);
  }

  public async decide(
    id: number,
    dto: DecideLeaveDto,
    actor: AuthUser,
  ): Promise<PublicLeaveRequest> {
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('Only a manager or administrator can act on leave requests');
    }

    const request = await this.leaves.findRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');
    if (request.status !== LeaveStatuses.PENDING) {
      throw new BadRequestError(`This request is already ${request.status.toLowerCase()}`);
    }
    if (request.userId === actor.id) {
      throw new ForbiddenError('You cannot approve your own leave');
    }
    await this.scope.assertCanSee(actor, request.userId);

    const updated = await this.leaves.updateRequest(id, {
      status: dto.status,
      decisionRemark: dto.decisionRemark,
      actedAt: new Date(),
      approvedBy: { connect: { id: actor.id } },
      updatedBy: actor.id,
    });

    if (dto.status === LeaveStatuses.APPROVED) {
      await this.markAttendanceForLeave(updated);
    }
    await this.refreshBalance(
      request.userId,
      request.leaveTypeId,
      request.fromDate.getUTCFullYear(),
      actor.id,
    );

    return this.toPublic(updated);
  }

  public async cancel(
    id: number,
    dto: CancelLeaveDto,
    actor: AuthUser,
  ): Promise<PublicLeaveRequest> {
    const request = await this.leaves.findRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');

    const isOwner = request.userId === actor.id;
    if (!isOwner) {
      if (actor.role === AppRoles.MR) {
        throw new ForbiddenError('You can only cancel your own leave');
      }
      await this.scope.assertCanSee(actor, request.userId);
    }

    if (request.status === LeaveStatuses.CANCELLED) {
      throw new BadRequestError('Already cancelled');
    }
    if (request.status === LeaveStatuses.REJECTED) {
      throw new BadRequestError('A rejected request cannot be cancelled');
    }
    // An approved leave that has already started stays on the record.
    if (request.status === LeaveStatuses.APPROVED && request.fromDate <= todayDateOnly()) {
      throw new BadRequestError(
        'This leave has already started — ask your manager to adjust attendance instead.',
      );
    }

    const updated = await this.leaves.updateRequest(id, {
      status: LeaveStatuses.CANCELLED,
      cancelledAt: new Date(),
      decisionRemark: dto.reason ?? request.decisionRemark,
      updatedBy: actor.id,
    });

    if (request.status === LeaveStatuses.APPROVED) {
      await this.clearAttendanceForLeave(request);
    }
    await this.refreshBalance(
      request.userId,
      request.leaveTypeId,
      request.fromDate.getUTCFullYear(),
      actor.id,
    );

    return this.toPublic(updated);
  }

  /** Pending count for the approvals inbox badge. */
  public async pendingCount(actor: AuthUser): Promise<number> {
    if (actor.role === AppRoles.MR) return 0;
    const userIds = await this.scope.visibleUserIds(actor);
    return this.leaves.countPending(userIds);
  }

  // ── Balances ───────────────────────────────────────────────────────────────

  public async balances(
    query: LeaveBalanceQueryDto,
    actor: AuthUser,
  ): Promise<{ year: number; userId: number; balances: PublicLeaveBalance[] }> {
    const userId = query.userId ?? actor.id;
    if (userId !== actor.id) await this.scope.assertCanSee(actor, userId);
    const year = query.year ?? currentYear();
    return { year, userId, balances: await this.balancesFor(userId, year) };
  }

  /**
   * Balance rows for a user/year. Missing rows are materialised from the
   * leave-type quota, so a new joiner immediately sees a correct entitlement.
   */
  public async balancesFor(userId: number, year: number): Promise<PublicLeaveBalance[]> {
    const [types, existing] = await Promise.all([
      this.leaves.listTypes(false),
      this.leaves.listBalances(userId, year),
    ]);
    const byType = new Map(existing.map((row) => [row.leaveTypeId, row]));

    const pendingByType = new Map<number, number>();
    const { items: pendingRequests } = await this.leaves.listRequests({
      page: 1,
      limit: 200,
      userId,
      status: 'PENDING',
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, 11, 31)),
    });
    for (const request of pendingRequests) {
      pendingByType.set(
        request.leaveTypeId,
        (pendingByType.get(request.leaveTypeId) ?? 0) + Number(request.days),
      );
    }

    return Promise.all(
      types.map(async (type) => {
        const row = byType.get(type.id);
        const opening = Number(row?.opening ?? 0);
        const allocated = row ? Number(row.allocated) : Number(type.annualQuota);
        const used = await this.leaves.sumApprovedDays(userId, type.id, year);
        const entitled = opening + allocated;
        const unlimited = !type.isPaid || Number(type.annualQuota) === 0;

        return {
          leaveTypeId: type.id,
          code: type.code,
          name: type.name,
          colorHex: type.colorHex,
          isPaid: type.isPaid,
          allowHalfDay: type.allowHalfDay,
          requiresProof: type.requiresProof,
          opening,
          allocated,
          entitled,
          used,
          pending: pendingByType.get(type.id) ?? 0,
          remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, entitled - used),
          unlimited,
        };
      }),
    ).then((rows) =>
      rows.map((row) => ({
        ...row,
        // JSON has no Infinity — unlimited types report 0 remaining with the flag set.
        remaining: row.unlimited ? 0 : row.remaining,
      })),
    );
  }

  /**
   * Grants comp-off days. Any `leaves:manage` holder can credit their own team —
   * that is the whole point: an ASM compensates a Sunday worked in the field
   * without waiting on an Admin. The grant is added to the year's allocation and
   * written to the audit log with the worked date.
   */
  public async grantCompOff(dto: GrantCompOffDto, actor: AuthUser) {
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('Only a manager or administrator can grant comp-off');
    }
    if (dto.userId === actor.id && actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('You cannot grant comp-off to yourself');
    }
    await this.scope.assertCanSee(actor, dto.userId);

    const target = await this.users.findById(dto.userId);
    if (!target || target.deletedAt) throw new NotFoundError('Employee not found');

    const type = dto.leaveTypeId
      ? await this.leaves.findTypeById(dto.leaveTypeId)
      : await this.leaves.findTypeByCode('COMP_OFF');
    if (!type || type.status !== 'ACTIVE') {
      throw new BadRequestError(
        'No active COMP_OFF leave type found. Add one under Leave policy first.',
      );
    }

    const year = currentYear();
    const existing = (await this.leaves.listBalances(dto.userId, year)).find(
      (row) => row.leaveTypeId === type.id,
    );
    const allocated = Number(existing?.allocated ?? 0) + dto.days;
    const used = await this.leaves.sumApprovedDays(dto.userId, type.id, year);

    const row = await this.leaves.upsertBalance({
      userId: dto.userId,
      leaveTypeId: type.id,
      year,
      opening: Number(existing?.opening ?? 0),
      allocated,
      used,
      actorId: actor.id,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'GRANT_COMP_OFF',
      entity: 'LeaveBalance',
      entityId: String(row.id),
      metadata: {
        employeeId: dto.userId,
        employee: target.fullName,
        days: dto.days,
        againstDate: dto.againstDate ?? null,
        allocatedNow: allocated,
        year,
        reason: dto.reason,
      },
    });

    return {
      userId: dto.userId,
      employeeName: target.fullName,
      leaveTypeId: type.id,
      code: type.code,
      year,
      granted: dto.days,
      allocated,
      used,
      remaining: Math.max(0, Number(row.opening) + allocated - used),
    };
  }

  public async setBalance(dto: SetLeaveBalanceDto, actor: AuthUser) {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only an administrator can set leave entitlement');
    }
    const type = await this.leaves.findTypeById(dto.leaveTypeId);
    if (!type) throw new NotFoundError('Leave type not found');
    const target = await this.users.findById(dto.userId);
    if (!target || target.deletedAt) throw new NotFoundError('Employee not found');

    const used = await this.leaves.sumApprovedDays(dto.userId, dto.leaveTypeId, dto.year);
    const row = await this.leaves.upsertBalance({
      userId: dto.userId,
      leaveTypeId: dto.leaveTypeId,
      year: dto.year,
      opening: dto.opening,
      allocated: dto.allocated,
      used,
      actorId: actor.id,
    });

    return {
      leaveTypeId: row.leaveTypeId,
      year: row.year,
      opening: Number(row.opening),
      allocated: Number(row.allocated),
      used: Number(row.used),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Sundays and non-optional holidays never consume leave. */
  private async countWorkingDays(
    fromDate: Date,
    toDate: Date,
    dayPart: string,
    territoryId?: number | null,
  ): Promise<number> {
    const blocked = await this.holidays.blockingDatesInRange(fromDate, toDate, territoryId);
    const working = eachDayInclusive(fromDate, toDate).filter(
      (day) => !isSunday(day) && !blocked.has(formatDateOnly(day)),
    );
    if (working.length === 0) return 0;
    if (dayPart !== LeaveDayParts.FULL) return 0.5;
    return working.length;
  }

  /** Approved leave writes the attendance register for every working day it covers. */
  private async markAttendanceForLeave(request: LeaveRequestRow): Promise<void> {
    const user = await this.users.findById(request.userId);
    const blocked = await this.holidays.blockingDatesInRange(
      request.fromDate,
      request.toDate,
      user?.territoryId,
    );

    for (const day of eachDayInclusive(request.fromDate, request.toDate)) {
      if (isSunday(day) || blocked.has(formatDateOnly(day))) continue;
      await this.attendance.upsertLeaveDay({
        userId: request.userId,
        attDate: day,
        leaveRequestId: request.id,
        remarks: `${request.leaveType.code} — ${request.reason}`.slice(0, 480),
        actorId: request.approvedById ?? request.userId,
      });
    }
  }

  /** Cancelling an approved future leave releases the attendance rows it created. */
  private async clearAttendanceForLeave(request: LeaveRequestRow): Promise<void> {
    await this.attendance.deleteLeaveDays(request.id);
  }

  private async refreshBalance(
    userId: number,
    leaveTypeId: number,
    year: number,
    actorId: number,
  ): Promise<void> {
    const type = await this.leaves.findTypeById(leaveTypeId);
    const used = await this.leaves.sumApprovedDays(userId, leaveTypeId, year);
    await this.leaves.upsertBalance({
      userId,
      leaveTypeId,
      year,
      used,
      allocated: type ? Number(type.annualQuota) : 0,
      actorId,
    });
  }

  private async resolveUserFilter(
    actor: AuthUser,
    requestedUserId?: number,
  ): Promise<{ userId?: number; userIds?: number[] }> {
    if (actor.role === AppRoles.MR) {
      if (requestedUserId && requestedUserId !== actor.id) {
        throw new ForbiddenError('You can only view your own leave');
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

  private toPublic(row: LeaveRequestRow): PublicLeaveRequest {
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
            designation: row.user.mrProfile?.designation ?? null,
          }
        : null,
      leaveType: row.leaveType
        ? {
            id: row.leaveType.id,
            code: row.leaveType.code,
            name: row.leaveType.name,
            colorHex: row.leaveType.colorHex,
            isPaid: row.leaveType.isPaid,
          }
        : null,
      fromDate: formatDateOnly(row.fromDate),
      toDate: formatDateOnly(row.toDate),
      dayPart: row.dayPart,
      days: Number(row.days),
      reason: row.reason,
      contactPhone: row.contactPhone,
      attachmentUrl: row.attachmentUrl,
      status: row.status,
      decisionRemark: row.decisionRemark,
      actedAt: row.actedAt?.toISOString() ?? null,
      approvedBy: row.approvedBy
        ? { id: row.approvedBy.id, fullName: row.approvedBy.fullName, role: row.approvedBy.role }
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
