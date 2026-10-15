import { AppRoles, AttendanceStatuses, WorkTypes } from '../constants';
import type {
  AttendanceCalendarQueryDto,
  AttendanceSummaryQueryDto,
  CheckInDto,
  CheckOutDto,
  CreateRegularizationDto,
  DecideRegularizationDto,
  ListAttendanceQueryDto,
  ListRegularizationsQueryDto,
  ManageAttendanceDto,
  ReviewFlagDto,
} from '../dto/attendance.dto';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import {
  AttendanceRepository,
  type RegularizationRow,
} from '../repositories/AttendanceRepository';
import { SettingRepository } from '../repositories/SettingRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuditService } from './AuditService';
import { HolidayService } from './HolidayService';
import { NotificationService } from './NotificationService';
import { TeamScopeService } from './TeamScopeService';
import {
  addDays,
  eachDayInclusive,
  formatDateOnly,
  isSunday,
  localMinutesOfDay,
  monthRange,
  parseClockToMinutes,
  parseDateOnly,
  todayDateOnly,
} from '../utils/datetime';
import { haversineDistanceM } from '../utils/geo';
import type { AuthUser } from '../types/auth.types';

/** Settings keys this service reads (all optional, sensible fallbacks below). */
const SETTING_SHIFT_START = 'attendance.shiftStart';
const SETTING_LATE_GRACE = 'attendance.lateGraceMinutes';
const SETTING_MIN_ACCURACY = 'attendance.minGpsAccuracyM';

const DEFAULT_SHIFT_START = '09:30';
const DEFAULT_LATE_GRACE_MIN = 15;
const DEFAULT_MIN_ACCURACY_M = 150;

function canSelfMark(role: string): boolean {
  return role === AppRoles.MR || role === AppRoles.MANAGER;
}

function canManage(role: string): boolean {
  return role === AppRoles.ADMIN || role === AppRoles.MANAGER;
}

export interface AttendanceCalendarDay {
  date: string;
  weekday: number;
  isSunday: boolean;
  holiday: { name: string; type: string; isOptional: boolean } | null;
  status: string | null;
  workType: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingHours: number | null;
  flagReason: string | null;
  remarks: string | null;
  isFuture: boolean;
}

/**
 * Attendance rules:
 * - ADMIN: never self check-in; view all; mark statuses for field users
 * - MANAGER: self check-in; view team + self; can manage team marks
 * - MR: self check-in/out only; view own
 *
 * Day boundaries always come from `utils/datetime` (business timezone), never from
 * a raw `toISOString()` — see the note in that file.
 */
export class AttendanceService {
  private static instance: AttendanceService | null = null;

  private constructor(
    private readonly attendance = AttendanceRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly settings = SettingRepository.getInstance(),
    private readonly holidays = HolidayService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
    private readonly notifications = NotificationService.getInstance(),
  ) {}

  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) AttendanceService.instance = new AttendanceService();
    return AttendanceService.instance;
  }

  public async list(query: ListAttendanceQueryDto, actor: AuthUser) {
    const scope = await this.resolveListScope(query, actor);
    const { items, total } = await this.attendance.list({
      page: query.page,
      limit: query.limit,
      userId: scope.userId,
      userIds: scope.userIds,
      status: query.status,
      from: query.from ? parseDateOnly(query.from) : undefined,
      to: query.to ? parseDateOnly(query.to) : undefined,
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

  public async today(actor: AuthUser) {
    if (!canSelfMark(actor.role)) {
      return null;
    }
    const row = await this.attendance.findToday(actor.id, todayDateOnly());
    return row ? this.toPublic(row) : null;
  }

  public async checkIn(dto: CheckInDto, actor: AuthUser) {
    if (!canSelfMark(actor.role)) {
      throw new ForbiddenError(
        'Administrators cannot mark attendance. Manage team records instead.',
      );
    }

    const attDate = todayDateOnly();
    const existing = await this.attendance.findToday(actor.id, attDate);
    if (existing?.status === AttendanceStatuses.LEAVE && existing.leaveRequestId) {
      throw new BadRequestError(
        'Today is marked as approved leave. Cancel the leave before checking in.',
      );
    }

    const [shiftStart, graceMinutes, minAccuracy] = await Promise.all([
      this.readSetting(SETTING_SHIFT_START, DEFAULT_SHIFT_START),
      this.readNumberSetting(SETTING_LATE_GRACE, DEFAULT_LATE_GRACE_MIN),
      this.readNumberSetting(SETTING_MIN_ACCURACY, DEFAULT_MIN_ACCURACY_M),
    ]);

    const now = new Date();
    const shiftStartMinutes = parseClockToMinutes(shiftStart) ?? 570;
    const isLate = localMinutesOfDay(now) > shiftStartMinutes + graceMinutes;

    // Poor GPS or a spoofed location only flags the day — it never blocks fieldwork.
    const flags: string[] = [];
    if (dto.isMockLocation) flags.push('Mock location reported by device');
    if (dto.accuracyM !== undefined && dto.accuracyM > minAccuracy) {
      flags.push(`Low GPS accuracy (${Math.round(dto.accuracyM)}m)`);
    }
    if (dto.latitude === undefined || dto.longitude === undefined) {
      flags.push('No GPS coordinates captured');
    }
    const deviceAt = dto.deviceAt ? new Date(dto.deviceAt) : undefined;
    if (deviceAt && Math.abs(deviceAt.getTime() - now.getTime()) > 10 * 60 * 1000) {
      flags.push('Device clock differs from server by more than 10 minutes');
    }

    // Territory geo-fence: flag (never block) a check-in outside the HQ radius.
    let geofenceDistanceM: number | null = null;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const fence = (await this.attendance.findUserTerritory(actor.id))?.territory;
      if (
        fence &&
        fence.latitude !== null &&
        fence.longitude !== null &&
        fence.geofenceRadiusM !== null
      ) {
        geofenceDistanceM = haversineDistanceM(
          fence.latitude,
          fence.longitude,
          dto.latitude,
          dto.longitude,
        );
        if (geofenceDistanceM > fence.geofenceRadiusM) {
          flags.push(`Outside territory geo-fence (${geofenceDistanceM}m away)`);
        }
      }
    }

    const row = await this.attendance.upsertCheckIn({
      userId: actor.id,
      attDate,
      checkInAt: now,
      status: isLate ? AttendanceStatuses.LATE : AttendanceStatuses.PRESENT,
      workType: dto.workType,
      inLat: dto.latitude,
      inLng: dto.longitude,
      accuracyM: dto.accuracyM,
      isMockLocation: dto.isMockLocation,
      deviceAt,
      flagReason: flags.length > 0 ? flags.join(' · ') : null,
      geofenceDistanceM,
      locationNote: dto.locationNote,
      remarks: dto.remarks,
      actorId: actor.id,
    });
    return this.toPublic(row);
  }

  public async checkOut(dto: CheckOutDto, actor: AuthUser) {
    if (!canSelfMark(actor.role)) {
      throw new ForbiddenError('Administrators cannot check out attendance.');
    }
    const row = await this.attendance.findToday(actor.id, todayDateOnly());
    if (!row || !row.checkInAt) throw new NotFoundError('Check-in not found for today');
    if (row.checkOutAt) throw new BadRequestError('Already checked out');
    if (row.status === AttendanceStatuses.ABSENT) {
      throw new BadRequestError('Cannot check out an absent day');
    }

    const checkOutAt = new Date();
    const workingMins = Math.max(
      1,
      Math.round((checkOutAt.getTime() - row.checkInAt.getTime()) / 60000),
    );
    const updated = await this.attendance.update(row.id, {
      checkOutAt,
      workingMins,
      remarks: dto.remarks ?? row.remarks,
      updatedBy: actor.id,
    });
    return this.toPublic(updated);
  }

  /** Admin / Manager mark PRESENT · LATE · ABSENT (etc.) for a field user. */
  public async manage(dto: ManageAttendanceDto, actor: AuthUser) {
    if (!canManage(actor.role)) {
      throw new ForbiddenError('Only Admin or Manager can manage attendance marks');
    }

    const target = await this.users.findById(dto.userId);
    if (!target || target.deletedAt) throw new NotFoundError('User not found');
    if (target.role === AppRoles.ADMIN) {
      throw new BadRequestError('Cannot mark attendance for an Admin account');
    }
    await this.scope.assertCanSee(actor, dto.userId);

    const attDate = parseDateOnly(dto.attDate);
    if (attDate.getTime() > todayDateOnly().getTime()) {
      throw new BadRequestError('Attendance cannot be marked for a future date');
    }

    const existing = await this.attendance.findToday(dto.userId, attDate);
    if (existing?.leaveRequestId && dto.status !== AttendanceStatuses.LEAVE) {
      throw new BadRequestError(
        'This day comes from an approved leave request — cancel that leave to change it.',
      );
    }

    const row = await this.attendance.upsertManaged({
      userId: dto.userId,
      attDate,
      status: dto.status,
      workType: dto.workType ?? this.inferWorkType(dto.status),
      remarks: dto.remarks,
      actorId: actor.id,
    });
    return this.toPublic(row);
  }

  /**
   * Resolves a flagged check-in. Until this exists a flag never clears, so the
   * approvals inbox and the bell keep showing it forever — which is exactly the
   * "I already looked at it" complaint.
   */
  public async reviewFlag(id: number, dto: ReviewFlagDto, actor: AuthUser) {
    if (!canManage(actor.role)) {
      throw new ForbiddenError('Only Admin or Manager can review flagged check-ins');
    }

    const row = await this.attendance.findById(id);
    if (!row) throw new NotFoundError('Attendance entry not found');
    if (!row.flagReason) {
      throw new BadRequestError('This entry is not flagged');
    }
    await this.scope.assertCanSee(actor, row.userId);

    const trail = [row.remarks, `Flag reviewed by ${actor.fullName}: ${row.flagReason}`, dto.remarks]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 480);

    const updated = await this.attendance.update(id, {
      // Clearing flagReason is what removes it from the inbox and the bell.
      flagReason: null,
      approvedBy: { connect: { id: actor.id } },
      remarks: trail,
      ...(dto.outcome === 'REJECT'
        ? {
            status: AttendanceStatuses.ABSENT,
            checkInAt: null,
            checkOutAt: null,
            workingMins: null,
          }
        : {}),
      updatedBy: actor.id,
    });

    return this.toPublic(updated);
  }

  // ── Regularization (missed check-in / check-out) ───────────────────────────

  /** MR / Manager raises a fix for a day whose punches are missing. */
  public async createRegularization(dto: CreateRegularizationDto, actor: AuthUser) {
    if (!canSelfMark(actor.role)) {
      throw new ForbiddenError('Administrators have no personal attendance to regularize');
    }

    const attDate = parseDateOnly(dto.attDate);
    const today = todayDateOnly();
    if (attDate.getTime() > today.getTime()) {
      throw new BadRequestError('You cannot regularize a future date');
    }
    if (attDate.getTime() < addDays(today, -31).getTime()) {
      throw new BadRequestError('Regularization is only allowed for the last 31 days');
    }

    const attendance = await this.attendance.findToday(actor.id, attDate);
    if (attendance?.checkInAt && attendance.checkOutAt) {
      throw new ConflictError('That day already has a complete check-in and check-out');
    }
    if (attendance?.status === AttendanceStatuses.LEAVE && attendance.leaveRequestId) {
      throw new BadRequestError('That day is approved leave — cancel the leave instead');
    }

    const requestedInAt = dto.requestedInAt ? new Date(dto.requestedInAt) : null;
    const requestedOutAt = dto.requestedOutAt ? new Date(dto.requestedOutAt) : null;

    const existing = await this.attendance.findRegularizationByUserDate(actor.id, attDate);
    if (
      existing &&
      !existing.deletedAt &&
      (existing.status === 'PENDING' || existing.status === 'APPROVED')
    ) {
      throw new ConflictError(
        `A ${existing.status.toLowerCase()} regularization already exists for that date`,
      );
    }

    // The table is unique per user+date, so a rejected request is re-opened in place.
    const row = existing
      ? await this.attendance.updateRegularization(existing.id, {
          requestedInAt,
          requestedOutAt,
          reason: dto.reason,
          status: 'PENDING',
          decidedBy: { disconnect: true },
          actedAt: null,
          decisionRemark: null,
          deletedAt: null,
        })
      : await this.attendance.createRegularization({
          userId: actor.id,
          attDate,
          requestedInAt,
          requestedOutAt,
          reason: dto.reason,
        });

    await this.audits.log({
      userId: actor.id,
      action: 'REGULARIZATION_REQUESTED',
      entity: 'AttendanceRegularization',
      entityId: String(row.id),
      metadata: {
        attDate: dto.attDate,
        requestedInAt: dto.requestedInAt ?? null,
        requestedOutAt: dto.requestedOutAt ?? null,
        reason: dto.reason,
      },
    });

    const managerId = (await this.attendance.findUserTerritory(actor.id))?.managerId;
    if (managerId) {
      await this.notifications.create({
        userId: managerId,
        kind: 'REGULARIZATION_PENDING',
        title: `${actor.fullName} asked to regularize attendance`,
        message: `${dto.attDate} · ${dto.reason}`.slice(0, 480),
        href: '/approvals',
        tone: 'warning',
      });
    }

    return this.toPublicRegularization(row);
  }

  /** Own requests for an MR; team scope for `attendance:manage` holders. */
  public async listRegularizations(query: ListRegularizationsQueryDto, actor: AuthUser) {
    const canManageTeam =
      canManage(actor.role) && (actor.permissions ?? []).includes('attendance:manage');

    let userId: number | undefined;
    let userIds: number[] | undefined;
    if (!canManageTeam) {
      userId = actor.id;
      if (query.userId && query.userId !== actor.id) {
        throw new ForbiddenError('You can only view your own regularizations');
      }
    } else if (actor.role === AppRoles.ADMIN) {
      userId = query.userId;
    } else {
      const teamIds = (await this.scope.visibleUserIds(actor)) ?? [];
      if (query.userId) {
        if (!teamIds.includes(query.userId)) {
          throw new ForbiddenError('That employee is outside your team scope');
        }
        userId = query.userId;
      } else {
        userIds = teamIds;
      }
    }

    let from: Date | undefined;
    let to: Date | undefined;
    if (query.month) {
      const anchor = parseDateOnly(
        query.month.length === 7 ? `${query.month}-01` : query.month,
      );
      const range = monthRange(anchor);
      from = range.start;
      to = range.end;
    }

    const rows = await this.attendance.listRegularizations({
      userId,
      userIds,
      status: query.status,
      from,
      to,
    });
    return rows.map((row) => this.toPublicRegularization(row));
  }

  /**
   * Manager decision. Approval upserts the attendance row: real punches win over
   * requested ones, working minutes are recomputed and the late rule re-applied.
   */
  public async decideRegularization(
    id: number,
    dto: DecideRegularizationDto,
    actor: AuthUser,
  ) {
    if (!canManage(actor.role)) {
      throw new ForbiddenError('Only Admin or Manager can decide regularizations');
    }

    const row = await this.attendance.findRegularizationById(id);
    if (!row) throw new NotFoundError('Regularization request not found');
    if (row.status !== 'PENDING') {
      throw new BadRequestError(`This request is already ${row.status.toLowerCase()}`);
    }
    if (row.userId === actor.id) {
      throw new ForbiddenError('You cannot decide your own regularization');
    }
    await this.scope.assertCanSee(actor, row.userId);

    const updated = await this.attendance.updateRegularization(id, {
      status: dto.status,
      decidedBy: { connect: { id: actor.id } },
      actedAt: new Date(),
      decisionRemark: dto.remark,
    });

    if (dto.status === 'APPROVED') {
      const attendance = await this.attendance.findToday(row.userId, row.attDate);
      // Keep any punch that really happened; fill only the missing side.
      const checkInAt = attendance?.checkInAt ?? row.requestedInAt ?? null;
      const checkOutAt = attendance?.checkOutAt ?? row.requestedOutAt ?? null;
      const workingMins =
        checkInAt && checkOutAt
          ? Math.max(1, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000))
          : (attendance?.workingMins ?? null);

      const status = checkInAt && (await this.isLateAt(checkInAt))
        ? AttendanceStatuses.LATE
        : AttendanceStatuses.PRESENT;

      const remarks = [attendance?.remarks, `Regularized — ${row.reason}`, dto.remark]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 480);

      await this.attendance.upsertRegularized({
        userId: row.userId,
        attDate: row.attDate,
        checkInAt,
        checkOutAt,
        workingMins,
        status,
        workType: attendance?.workType ?? WorkTypes.FIELD,
        remarks,
        actorId: actor.id,
      });
    }

    await this.audits.log({
      userId: actor.id,
      action: 'REGULARIZATION_DECIDED',
      entity: 'AttendanceRegularization',
      entityId: String(id),
      metadata: {
        employeeId: row.userId,
        attDate: formatDateOnly(row.attDate),
        status: dto.status,
        remark: dto.remark ?? null,
      },
    });

    await this.notifications.create({
      userId: row.userId,
      kind: 'REGULARIZATION_DECIDED',
      title: `Regularization for ${formatDateOnly(row.attDate)} ${dto.status.toLowerCase()}`,
      message: [dto.status === 'APPROVED' ? 'Your attendance was updated' : null, dto.remark]
        .filter(Boolean)
        .join(' · ') || `Decided by ${actor.fullName}`,
      href: '/attendance',
      tone: dto.status === 'APPROVED' ? 'success' : 'danger',
    });

    return this.toPublicRegularization(updated);
  }

  /** Pending count for the approvals inbox. */
  public async pendingRegularizationCount(actor: AuthUser): Promise<number> {
    if (!canManage(actor.role)) return 0;
    const userIds = await this.scope.visibleUserIds(actor);
    const rows = await this.attendance.listRegularizations({
      userIds,
      status: 'PENDING',
      limit: 500,
    });
    return rows.filter((row) => row.userId !== actor.id).length;
  }

  private async isLateAt(checkInAt: Date): Promise<boolean> {
    const [shiftStart, graceMinutes] = await Promise.all([
      this.readSetting(SETTING_SHIFT_START, DEFAULT_SHIFT_START),
      this.readNumberSetting(SETTING_LATE_GRACE, DEFAULT_LATE_GRACE_MIN),
    ]);
    const shiftStartMinutes = parseClockToMinutes(shiftStart) ?? 570;
    return localMinutesOfDay(checkInAt) > shiftStartMinutes + graceMinutes;
  }

  private toPublicRegularization(row: RegularizationRow) {
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
      attDate: formatDateOnly(row.attDate),
      requestedInAt: row.requestedInAt?.toISOString() ?? null,
      requestedOutAt: row.requestedOutAt?.toISOString() ?? null,
      reason: row.reason,
      status: row.status,
      decisionRemark: row.decisionRemark,
      actedAt: row.actedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy
        ? { id: row.decidedBy.id, fullName: row.decidedBy.fullName }
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  public async fieldUsers(actor: AuthUser) {
    if (!canManage(actor.role)) {
      throw new ForbiddenError('Only Admin or Manager can list field users');
    }
    const userIds = await this.scope.visibleUserIds(actor);
    const rows = await this.users.listTeamMembers(userIds);
    return rows
      .filter((row) => row.status === 'ACTIVE')
      .map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        role: row.role,
        employeeCode: row.mrProfile?.employeeCode ?? null,
      }));
  }

  /**
   * Month grid for one employee — attendance rows merged with the holiday calendar,
   * so the UI can render a real register instead of a bare list.
   */
  public async calendar(
    query: AttendanceCalendarQueryDto,
    actor: AuthUser,
  ): Promise<{
    userId: number;
    month: string;
    days: AttendanceCalendarDay[];
    summary: Record<string, number> & { workingDays: number; workingHours: number };
  }> {
    const userId = query.userId ?? actor.id;
    if (userId !== actor.id) await this.scope.assertCanSee(actor, userId);

    const anchor = query.month ? parseDateOnly(query.month) : todayDateOnly();
    const { start, end } = monthRange(anchor);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Employee not found');

    const [rows, holidayMap] = await Promise.all([
      this.attendance.listForUserRange(userId, start, end),
      this.holidays.mapInRange(start, end, user.territoryId),
    ]);
    const byDate = new Map(rows.map((row) => [formatDateOnly(row.attDate), row]));
    const today = todayDateOnly().getTime();

    const days: AttendanceCalendarDay[] = eachDayInclusive(start, end).map((day) => {
      const key = formatDateOnly(day);
      const row = byDate.get(key);
      const holiday = holidayMap.get(key) ?? null;
      return {
        date: key,
        weekday: day.getUTCDay(),
        isSunday: isSunday(day),
        holiday: holiday
          ? { name: holiday.name, type: holiday.type, isOptional: holiday.isOptional }
          : null,
        status: row?.status ?? null,
        workType: row?.workType ?? null,
        checkInAt: row?.checkInAt?.toISOString() ?? null,
        checkOutAt: row?.checkOutAt?.toISOString() ?? null,
        workingHours:
          row?.workingMins != null ? Number((row.workingMins / 60).toFixed(2)) : null,
        flagReason: row?.flagReason ?? null,
        remarks: row?.remarks ?? null,
        isFuture: day.getTime() > today,
      };
    });

    const counts: Record<string, number> = {};
    let workingMinutes = 0;
    for (const day of days) {
      if (day.status) counts[day.status] = (counts[day.status] ?? 0) + 1;
      workingMinutes += day.workingHours ? day.workingHours * 60 : 0;
    }
    const workingDays = days.filter(
      (day) => !day.isSunday && !(day.holiday && !day.holiday.isOptional) && !day.isFuture,
    ).length;

    return {
      userId,
      month: formatDateOnly(start).slice(0, 7),
      days,
      summary: {
        ...counts,
        workingDays,
        workingHours: Number((workingMinutes / 60).toFixed(1)),
      },
    };
  }

  /** Status counts for a window — powers the profile and dashboard tiles. */
  public async summary(query: AttendanceSummaryQueryDto, actor: AuthUser) {
    const userId = query.userId ?? actor.id;
    if (userId !== actor.id) await this.scope.assertCanSee(actor, userId);

    let from: Date;
    let to: Date;
    if (query.from && query.to) {
      from = parseDateOnly(query.from);
      to = parseDateOnly(query.to);
    } else {
      const range = monthRange(query.month ? parseDateOnly(query.month) : todayDateOnly());
      from = range.start;
      to = range.end;
    }

    const result = await this.attendance.summarize(userId, from, to);
    const counts: Record<string, number> = {};
    for (const row of result.byStatus) counts[row.status] = row.count;

    return {
      userId,
      from: formatDateOnly(from),
      to: formatDateOnly(to),
      present: counts[AttendanceStatuses.PRESENT] ?? 0,
      late: counts[AttendanceStatuses.LATE] ?? 0,
      absent: counts[AttendanceStatuses.ABSENT] ?? 0,
      leave: counts[AttendanceStatuses.LEAVE] ?? 0,
      holiday: counts[AttendanceStatuses.HOLIDAY] ?? 0,
      office: counts[AttendanceStatuses.OFFICE] ?? 0,
      jointWork: counts[AttendanceStatuses.JOINT_WORK] ?? 0,
      flagged: counts[AttendanceStatuses.FLAGGED] ?? 0,
      workingHours: Number((result.workingMins / 60).toFixed(1)),
    };
  }

  private inferWorkType(status: string): 'FIELD' | 'OFFICE' | 'JOINT_WORK' | 'LEAVE' | 'HOLIDAY' {
    if (status === AttendanceStatuses.LEAVE) return WorkTypes.LEAVE;
    if (status === AttendanceStatuses.HOLIDAY) return WorkTypes.HOLIDAY;
    if (status === AttendanceStatuses.OFFICE) return WorkTypes.OFFICE;
    if (status === AttendanceStatuses.JOINT_WORK) return WorkTypes.JOINT_WORK;
    return WorkTypes.FIELD;
  }

  private async readSetting(key: string, fallback: string): Promise<string> {
    const row = await this.settings.findByKey(key);
    return row?.value?.trim() || fallback;
  }

  private async readNumberSetting(key: string, fallback: number): Promise<number> {
    const raw = await this.readSetting(key, String(fallback));
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private async resolveListScope(query: ListAttendanceQueryDto, actor: AuthUser) {
    const filterUserId = query.userId ?? query.mrId;

    if (actor.role === AppRoles.MR) {
      return { userId: actor.id, userIds: undefined as number[] | undefined };
    }

    if (actor.role === AppRoles.MANAGER) {
      const teamIds = (await this.scope.visibleUserIds(actor)) ?? [];
      if (filterUserId) {
        if (!teamIds.includes(filterUserId)) {
          throw new ForbiddenError('User is outside your team scope');
        }
        return { userId: filterUserId, userIds: undefined };
      }
      return { userId: undefined, userIds: teamIds };
    }

    // ADMIN — company-wide
    return { userId: filterUserId, userIds: undefined };
  }

  private toPublic(item: {
    id: number;
    userId: number;
    attDate: Date;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    workingMins: number | null;
    status?: string;
    workType?: string | null;
    leaveRequestId?: number | null;
    inLat?: number | null;
    inLng?: number | null;
    accuracyM?: number | null;
    geofenceDistanceM?: number | null;
    isMockLocation?: boolean;
    locationNote?: string | null;
    remarks?: string | null;
    flagReason?: string | null;
    user?: { id: number; fullName: string; email: string; role?: string };
  }) {
    return {
      id: item.id,
      mrId: item.userId,
      userId: item.userId,
      workDate: formatDateOnly(item.attDate),
      attDate: formatDateOnly(item.attDate),
      checkInAt: item.checkInAt?.toISOString() ?? null,
      checkOutAt: item.checkOutAt?.toISOString() ?? null,
      workingMins: item.workingMins,
      workingHours: item.workingMins != null ? Number((item.workingMins / 60).toFixed(2)) : null,
      status: item.status ?? AttendanceStatuses.PRESENT,
      workType: item.workType ?? null,
      leaveRequestId: item.leaveRequestId ?? null,
      latitude: item.inLat ?? null,
      longitude: item.inLng ?? null,
      inLat: item.inLat ?? null,
      inLng: item.inLng ?? null,
      accuracyM: item.accuracyM ?? null,
      geofenceDistanceM: item.geofenceDistanceM ?? null,
      isMockLocation: item.isMockLocation ?? false,
      locationNote: item.locationNote ?? null,
      remarks: item.remarks ?? null,
      flagReason: item.flagReason ?? null,
      mr: item.user
        ? {
            id: item.user.id,
            fullName: item.user.fullName,
            email: item.user.email,
            role: item.user.role,
          }
        : null,
      user: item.user ?? null,
    };
  }
}
