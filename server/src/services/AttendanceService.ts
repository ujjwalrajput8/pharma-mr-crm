import { AppRoles } from '../constants';
import type { CheckInDto, CheckOutDto, ListAttendanceQueryDto } from '../dto/attendance.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import type { AuthUser } from '../types/auth.types';

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export class AttendanceService {
  private static instance: AttendanceService | null = null;
  private constructor(private readonly attendance = AttendanceRepository.getInstance()) {}
  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) AttendanceService.instance = new AttendanceService();
    return AttendanceService.instance;
  }

  public async list(query: ListAttendanceQueryDto, actor: AuthUser) {
    const { items, total } = await this.attendance.list({
      page: query.page,
      limit: query.limit,
      mrId: actor.role === AppRoles.MR ? actor.id : query.mrId,
      from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
      to: query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined,
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
    const row = await this.attendance.findToday(actor.id, todayDateOnly());
    return row ? this.toPublic(row) : null;
  }

  public async checkIn(dto: CheckInDto, actor: AuthUser) {
    if (actor.role !== AppRoles.MR && actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only field users can check in');
    }
    const mrId = actor.role === AppRoles.MR ? actor.id : actor.id;
    const row = await this.attendance.upsertCheckIn({
      mrId,
      workDate: todayDateOnly(),
      checkInAt: new Date(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationNote: dto.locationNote,
      remarks: dto.remarks,
      actorId: actor.id,
    });
    return this.toPublic(row);
  }

  public async checkOut(dto: CheckOutDto, actor: AuthUser) {
    const row = await this.attendance.findToday(actor.id, todayDateOnly());
    if (!row || !row.checkInAt) throw new NotFoundError('Check-in not found for today');
    if (row.checkOutAt) throw new BadRequestError('Already checked out');

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

  private toPublic(item: {
    id: number;
    mrId: number;
    workDate: Date;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    workingMins: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locationNote?: string | null;
    remarks?: string | null;
    mr?: { id: number; fullName: string; email: string };
  }) {
    return {
      id: item.id,
      mrId: item.mrId,
      workDate: item.workDate.toISOString().slice(0, 10),
      checkInAt: item.checkInAt?.toISOString() ?? null,
      checkOutAt: item.checkOutAt?.toISOString() ?? null,
      workingMins: item.workingMins,
      workingHours: item.workingMins != null ? Number((item.workingMins / 60).toFixed(2)) : null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      locationNote: item.locationNote ?? null,
      remarks: item.remarks ?? null,
      mr: item.mr ?? null,
    };
  }
}
