import type { CreateHolidayDto, ListHolidaysQueryDto, UpdateHolidayDto } from '../dto/holiday.dto';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { HolidayRepository } from '../repositories/HolidayRepository';
import { currentYear, formatDateOnly, parseDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

export interface PublicHoliday {
  id: number;
  holidayDate: string;
  name: string;
  type: string;
  isOptional: boolean;
  description: string | null;
  status: string;
  territory: { id: number; name: string; type: string } | null;
  /** Sun / Mon … — handy for the calendar UI. */
  weekday: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * HolidayService — holiday calendar master plus the lookup leave/attendance rely on.
 */
export class HolidayService {
  private static instance: HolidayService | null = null;

  private constructor(private readonly holidays = HolidayRepository.getInstance()) {}

  public static getInstance(): HolidayService {
    if (!HolidayService.instance) HolidayService.instance = new HolidayService();
    return HolidayService.instance;
  }

  public async list(query: ListHolidaysQueryDto): Promise<PublicHoliday[]> {
    const { from, to } = this.resolveRange(query);
    const rows = await this.holidays.list({
      from,
      to,
      territoryId: query.territoryId,
      includeInactive: query.includeInactive,
    });
    return rows.map((row) => this.toPublic(row));
  }

  public async create(dto: CreateHolidayDto, actor: AuthUser): Promise<PublicHoliday> {
    const holidayDate = parseDateOnly(dto.holidayDate);
    const existing = await this.holidays.findByDateAndName(holidayDate, dto.name);
    if (existing && !existing.deletedAt) {
      throw new ConflictError('This holiday already exists on that date');
    }

    const row = await this.holidays.create({
      holidayDate,
      name: dto.name,
      type: dto.type,
      isOptional: dto.isOptional,
      description: dto.description,
      status: dto.status,
      createdBy: actor.id,
      updatedBy: actor.id,
      ...(dto.territoryId ? { territory: { connect: { id: dto.territoryId } } } : {}),
    });
    return this.toPublic(row);
  }

  public async update(id: number, dto: UpdateHolidayDto, actor: AuthUser): Promise<PublicHoliday> {
    const existing = await this.holidays.findById(id);
    if (!existing) throw new NotFoundError('Holiday not found');

    const row = await this.holidays.update(id, {
      ...(dto.holidayDate !== undefined ? { holidayDate: parseDateOnly(dto.holidayDate) } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.isOptional !== undefined ? { isOptional: dto.isOptional } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.territoryId !== undefined
        ? dto.territoryId
          ? { territory: { connect: { id: dto.territoryId } } }
          : { territory: { disconnect: true } }
        : {}),
      updatedBy: actor.id,
    });
    return this.toPublic(row);
  }

  public async remove(id: number, actor: AuthUser): Promise<void> {
    const existing = await this.holidays.findById(id);
    if (!existing) throw new NotFoundError('Holiday not found');
    await this.holidays.softDelete(id, actor.id);
  }

  /**
   * Set of `YYYY-MM-DD` strings that count as non-working in a window.
   * Optional (restricted) holidays are excluded — the employee must still apply for those.
   */
  public async blockingDatesInRange(
    from: Date,
    to: Date,
    territoryId?: number | null,
  ): Promise<Set<string>> {
    const rows = await this.holidays.list({
      from,
      to,
      territoryId: territoryId ?? undefined,
    });
    return new Set(
      rows.filter((row) => !row.isOptional).map((row) => formatDateOnly(row.holidayDate)),
    );
  }

  /** Map of date → holiday for calendar rendering. */
  public async mapInRange(
    from: Date,
    to: Date,
    territoryId?: number | null,
  ): Promise<Map<string, PublicHoliday>> {
    const rows = await this.holidays.list({ from, to, territoryId: territoryId ?? undefined });
    return new Map(rows.map((row) => [formatDateOnly(row.holidayDate), this.toPublic(row)]));
  }

  private resolveRange(query: ListHolidaysQueryDto): { from?: Date; to?: Date } {
    if (query.from || query.to) {
      return {
        from: query.from ? parseDateOnly(query.from) : undefined,
        to: query.to ? parseDateOnly(query.to) : undefined,
      };
    }
    const year = query.year ?? currentYear();
    return {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, 11, 31)),
    };
  }

  private toPublic(row: {
    id: number;
    holidayDate: Date;
    name: string;
    type: string;
    isOptional: boolean;
    description: string | null;
    status: string;
    territory?: { id: number; name: string; type: string } | null;
  }): PublicHoliday {
    return {
      id: row.id,
      holidayDate: formatDateOnly(row.holidayDate),
      name: row.name,
      type: row.type,
      isOptional: row.isOptional,
      description: row.description,
      status: row.status,
      territory: row.territory ?? null,
      weekday: WEEKDAYS[row.holidayDate.getUTCDay()] ?? '',
    };
  }
}
