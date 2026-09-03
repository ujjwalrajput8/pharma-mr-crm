import { AppRoles, AttendanceStatuses, WorkTypes } from '../constants';
import type {
  AttendanceCalendarQueryDto,
  AttendanceSummaryQueryDto,
  CheckInDto,
  CheckOutDto,
  ListAttendanceQueryDto,
  ManageAttendanceDto,
} from '../dto/attendance.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { SettingRepository } from '../repositories/SettingRepository';
import { UserRepository } from '../repositories/UserRepository';
import { HolidayService } from './HolidayService';
import { TeamScopeService } from './TeamScopeService';
import {
  eachDayInclusive,
  formatDateOnly,
  isSunday,
  localMinutesOfDay,
  monthRange,
  parseClockToMinutes,
  parseDateOnly,
  todayDateOnly,
} from '../utils/datetime';
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
