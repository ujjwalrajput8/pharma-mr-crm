import { AppRoles, AttendanceStatuses } from '../constants';
import type {
  CheckInDto,
  CheckOutDto,
  ListAttendanceQueryDto,
  ManageAttendanceDto,
} from '../dto/attendance.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function canSelfMark(role: string): boolean {
  return role === AppRoles.MR || role === AppRoles.MANAGER;
}

function canManage(role: string): boolean {
  return role === AppRoles.ADMIN || role === AppRoles.MANAGER;
}

/**
 * Attendance rules:
 * - ADMIN: never self check-in; view all; mark late/absent/present for field users
 * - MANAGER: self check-in; view team + self; can manage team marks
 * - MR: self check-in/out only; view own
 */
export class AttendanceService {
  private static instance: AttendanceService | null = null;

  private constructor(
    private readonly attendance = AttendanceRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
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
      throw new ForbiddenError('Administrators cannot mark attendance. Manage team records instead.');
    }
    const row = await this.attendance.upsertCheckIn({
      userId: actor.id,
      attDate: todayDateOnly(),
      checkInAt: new Date(),
      inLat: dto.latitude,
      inLng: dto.longitude,
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

    if (actor.role === AppRoles.MANAGER) {
      const reportIds = await this.attendance.listReportUserIds(actor.id);
      if (!reportIds.includes(dto.userId) && dto.userId !== actor.id) {
        throw new ForbiddenError('You can only manage attendance for your team');
      }
    }

    const row = await this.attendance.upsertManaged({
      userId: dto.userId,
      attDate: parseDateOnly(dto.attDate),
      status: dto.status,
      remarks: dto.remarks,
      actorId: actor.id,
    });
    return this.toPublic(row);
  }

  public async fieldUsers(actor: AuthUser) {
    if (!canManage(actor.role)) {
      throw new ForbiddenError('Only Admin or Manager can list field users');
    }
    if (actor.role === AppRoles.ADMIN) {
      return this.attendance.listFieldUsers({ roles: [AppRoles.MR, AppRoles.MANAGER] });
    }
    return this.attendance.listFieldUsers({
      roles: [AppRoles.MR, AppRoles.MANAGER],
      managerId: actor.id,
    });
  }

  private async resolveListScope(query: ListAttendanceQueryDto, actor: AuthUser) {
    const filterUserId = query.userId ?? query.mrId;

    if (actor.role === AppRoles.MR) {
      return { userId: actor.id, userIds: undefined as number[] | undefined };
    }

    if (actor.role === AppRoles.MANAGER) {
      const reportIds = await this.attendance.listReportUserIds(actor.id);
      const teamIds = [...new Set([actor.id, ...reportIds])];
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
    inLat?: number | null;
    inLng?: number | null;
    locationNote?: string | null;
    remarks?: string | null;
    flagReason?: string | null;
    user?: { id: number; fullName: string; email: string; role?: string };
  }) {
    return {
      id: item.id,
      mrId: item.userId,
      userId: item.userId,
      workDate: item.attDate.toISOString().slice(0, 10),
      attDate: item.attDate.toISOString().slice(0, 10),
      checkInAt: item.checkInAt?.toISOString() ?? null,
      checkOutAt: item.checkOutAt?.toISOString() ?? null,
      workingMins: item.workingMins,
      workingHours: item.workingMins != null ? Number((item.workingMins / 60).toFixed(2)) : null,
      status: item.status ?? AttendanceStatuses.PRESENT,
      latitude: item.inLat ?? null,
      longitude: item.inLng ?? null,
      inLat: item.inLat ?? null,
      inLng: item.inLng ?? null,
      locationNote: item.locationNote ?? null,
      remarks: item.remarks ?? null,
      flagReason: item.flagReason ?? null,
      mr: item.user
        ? { id: item.user.id, fullName: item.user.fullName, email: item.user.email, role: item.user.role }
        : null,
      user: item.user ?? null,
    };
  }
}
