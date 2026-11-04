import { HolidayTypes } from '../constants';
import type { ImportHolidaysDto } from '../dto/holiday.dto';
import { PrismaService } from '../prisma/PrismaService';
import { parseDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';
import { AuditService } from './AuditService';
import { HolidayService } from './HolidayService';

type HolidayType = (typeof HolidayTypes)[keyof typeof HolidayTypes];

/** What will happen to one sheet row. */
export type HolidayImportStatus = 'NEW' | 'RESTORE' | 'DUPLICATE_IN_FILE' | 'EXISTS' | 'INVALID';

export interface HolidayImportRow {
  rowNumber: number;
  date: string | null;
  name: string | null;
  type: HolidayType | null;
  isOptional: boolean;
  description: string | null;
  status: HolidayImportStatus;
  /** Why a row is skipped or invalid; empty for NEW / RESTORE. */
  message: string | null;
}

export interface HolidayImportResult {
  dryRun: boolean;
  summary: { total: number; added: number; restored: number; duplicates: number; invalid: number };
  rows: HolidayImportRow[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Spellings people type in the Type column, after lower-casing and dropping non-letters. */
const TYPE_ALIASES: Record<string, HolidayType> = {
  national: HolidayTypes.NATIONAL,
  nationalholiday: HolidayTypes.NATIONAL,
  gazetted: HolidayTypes.NATIONAL,
  festival: HolidayTypes.FESTIVAL,
  festive: HolidayTypes.FESTIVAL,
  regional: HolidayTypes.REGIONAL,
  state: HolidayTypes.REGIONAL,
  local: HolidayTypes.REGIONAL,
  company: HolidayTypes.COMPANY,
  companyholiday: HolidayTypes.COMPANY,
  weeklyoff: HolidayTypes.WEEKLY_OFF,
  weekoff: HolidayTypes.WEEKLY_OFF,
  off: HolidayTypes.WEEKLY_OFF,
};

const YES = new Set(['yes', 'y', 'true', '1', 'optional', 'restricted', 'rh']);
const NO = new Set(['no', 'n', 'false', '0']);

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

/**
 * Dates as they appear in holiday sheets: 2026-11-15 · 15-11-2026 · 15/11/2026 ·
 * 15.11.2026 · 15 Nov 2026 · 15th November 2026 · Nov 15, 2026 · an Excel day number.
 * Numeric day / month order is Indian (day first).
 */
export function parseHolidayDate(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?[\s,-]+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[2]!.slice(0, 3).toLowerCase()];
    return month ? isoDate(Number(match[3]), month, Number(match[1])) : null;
  }
  match = raw.match(/^([a-z]+)\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s-]+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[1]!.slice(0, 3).toLowerCase()];
    return month ? isoDate(Number(match[3]), month, Number(match[2])) : null;
  }
  return null;
}

const keyOf = (date: string, name: string) => `${date}|${name.toLowerCase()}`;

/**
 * Bulk holiday import from Excel / CSV. Add-only: a holiday already in the
 * calendar (same date + name) is skipped; one that was deleted is restored.
 */
export class HolidayImportService {
  private static instance: HolidayImportService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly holidays = HolidayService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): HolidayImportService {
    if (!HolidayImportService.instance) HolidayImportService.instance = new HolidayImportService();
    return HolidayImportService.instance;
  }

  public async import(dto: ImportHolidaysDto, actor: AuthUser): Promise<HolidayImportResult> {
    const rows = dto.rows.map((row) => this.parseRow(row.rowNumber, row.values));

    // Duplicates inside the file: the first occurrence wins.
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.status !== 'NEW' || !row.date || !row.name) continue;
      const key = keyOf(row.date, row.name);
      if (seen.has(key)) {
        row.status = 'DUPLICATE_IN_FILE';
        row.message = 'Same date and name appear earlier in the file';
      }
      seen.add(key);
    }

    // Against the calendar, deleted holidays included (date + name is unique).
    const dates = [...new Set(rows.filter((row) => row.status === 'NEW').map((row) => row.date!))];
    const existing = dates.length
      ? await this.prisma.holiday.findMany({
          where: { holidayDate: { in: dates.map((date) => parseDateOnly(date)) } },
          select: { id: true, holidayDate: true, name: true, deletedAt: true },
        })
      : [];
    const byKey = new Map(existing.map((row) => [keyOf(row.holidayDate.toISOString().slice(0, 10), row.name), row]));
    for (const row of rows) {
      if (row.status !== 'NEW') continue;
      const match = byKey.get(keyOf(row.date!, row.name!));
      if (match && !match.deletedAt) {
        row.status = 'EXISTS';
        row.message = 'Already in the holiday calendar';
      } else if (match) {
        row.status = 'RESTORE';
      }
    }

    const summary = {
      total: rows.length,
      added: rows.filter((row) => row.status === 'NEW').length,
      restored: rows.filter((row) => row.status === 'RESTORE').length,
      duplicates: rows.filter((row) => row.status === 'DUPLICATE_IN_FILE' || row.status === 'EXISTS').length,
      invalid: rows.filter((row) => row.status === 'INVALID').length,
    };
    if (dto.dryRun || summary.added + summary.restored === 0) {
      return { dryRun: dto.dryRun, summary, rows };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const fields = {
          type: row.type!,
          isOptional: row.isOptional,
          description: row.description ?? undefined,
          status: 'ACTIVE' as const,
        };
        if (row.status === 'NEW') {
          await tx.holiday.create({
            data: { holidayDate: parseDateOnly(row.date!), name: row.name!, ...fields, createdBy: actor.id, updatedBy: actor.id },
          });
        } else if (row.status === 'RESTORE') {
          const match = byKey.get(keyOf(row.date!, row.name!))!;
          await tx.holiday.update({ where: { id: match.id }, data: this.holidays.restoreData(fields, actor.id) });
        }
      }
    });

    await this.audits.log({
      userId: actor.id,
      action: 'HOLIDAYS_IMPORTED',
      entity: 'Holiday',
      metadata: { fileName: dto.fileName ?? null, ...summary },
    });

    return { dryRun: false, summary, rows };
  }

  private parseRow(rowNumber: number, values: Record<string, unknown>): HolidayImportRow {
    const name = text(values.name);
    const rawDate = values.date;
    const date = parseHolidayDate(rawDate);
    const rawType = text(values.type);
    const type = rawType ? (TYPE_ALIASES[rawType.toLowerCase().replace(/[^a-z]/g, '')] ?? null) : HolidayTypes.NATIONAL;
    const rawOptional = text(values.optional).toLowerCase();
    const description = text(values.description) || null;
    const row: HolidayImportRow = {
      rowNumber,
      date,
      name: name || null,
      type,
      isOptional: YES.has(rawOptional),
      description,
      status: 'NEW',
      message: null,
    };

    const problem =
      (!text(rawDate) && 'Date is missing') ||
      (!date && `"${text(rawDate)}" is not a valid date (use 15-11-2026 or 2026-11-15)`) ||
      (!name && 'Holiday name is missing') ||
      (name.length < 2 && 'Holiday name is too short') ||
      (name.length > 120 && 'Holiday name is longer than 120 characters') ||
      (!type && `Type "${rawType}" is not known — use National, Festival, Regional, Company or Weekly off`) ||
      (rawOptional && !YES.has(rawOptional) && !NO.has(rawOptional) && `Optional should be Yes or No, not "${text(values.optional)}"`) ||
      ((description?.length ?? 0) > 500 && 'Description is longer than 500 characters') ||
      null;
    if (problem) {
      row.status = 'INVALID';
      row.message = problem;
    }
    return row;
  }
}
