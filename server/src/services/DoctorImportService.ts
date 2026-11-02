import type { Prisma } from '@prisma/client';
import { DoctorAreaTypes, type DoctorAreaType } from '../constants';
import type { ImportDoctorsDto } from '../dto/doctor.dto';
import { DoctorRepository } from '../repositories/DoctorRepository';
import { AuditService } from './AuditService';
import { parseDateOnly, toLocalDateString } from '../utils/datetime';
import { doctorDuplicateKey } from '../utils/doctorDuplicate';

type DoctorRow = Prisma.DoctorCreateManyInput;

/** Rows per multi-row INSERT. */
const CREATE_CHUNK = 500;

function toText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text === '' ? undefined : text;
}

const AREA_TYPE_WORDS: Record<string, DoctorAreaType> = {
  HQ: DoctorAreaTypes.HQ,
  HEADQUARTER: DoctorAreaTypes.HQ,
  HEADQUARTERS: DoctorAreaTypes.HQ,
  EX: DoctorAreaTypes.EX,
  EXHQ: DoctorAreaTypes.EX,
  EXSTATION: DoctorAreaTypes.EX,
  OS: DoctorAreaTypes.OS,
  OUTSTATION: DoctorAreaTypes.OS,
};

const toAreaType = (text: string): DoctorAreaType | undefined =>
  AREA_TYPE_WORDS[text.toUpperCase().replace(/[^A-Z]/g, '')];

const AREA_TYPE_PATTERN = 'ex[\\s.-]*hq|ex[\\s.-]*station|hq|ex|os|out[\\s-]*station|head[\\s-]*quarters?';
const AREA_SUFFIX = new RegExp(`^(.+?)(?:\\s+|\\s*[-–/(,:|]\\s*)(${AREA_TYPE_PATTERN})\\s*\\)?$`, 'i');
const AREA_PREFIX = new RegExp(`^(${AREA_TYPE_PATTERN})\\s*[-–/:|)]\\s*(.+)$`, 'i');

/**
 * The sheet's single "AREA-HQ/EX" cell → area + HQ/EX/OS.
 * "Boring Road-HQ", "Danapur EX", "Hajipur (OS)", "HQ - Kankarbagh", "EX", "Patna".
 */
function splitArea(text: string): { area?: string; areaType?: DoctorAreaType } {
  const whole = toAreaType(text);
  if (whole) return { areaType: whole };
  const suffix = text.match(AREA_SUFFIX);
  if (suffix?.[1] && suffix[2]) return { area: suffix[1].trim(), areaType: toAreaType(suffix[2]) };
  const prefix = text.match(AREA_PREFIX);
  if (prefix?.[1] && prefix[2]) return { area: prefix[2].trim(), areaType: toAreaType(prefix[1]) };
  return { area: text };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (value: number) => String(value).padStart(2, '0');

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${pad(month)}-${pad(day)}`
    : null;
}

/** A birth or wedding year is in the past: "75" → 1975, "05" → 2005. */
function pastYear(year: number): number {
  if (year >= 100) return year;
  const thisYear = new Date().getUTCFullYear();
  return 2000 + year > thisYear ? 1900 + year : 2000 + year;
}

/**
 * Accepts 1975-08-15, 15/08/1975, 15-08-75, 15.08.1975, 15-Aug-1975,
 * 15 August 1975, Aug 15 1975, and a raw Excel date number. Day-first.
 * `null` when the cell is filled but is not a full date.
 */
function toPersonalDate(value: unknown): string | null | undefined {
  if (typeof value === 'number') {
    // An Excel date cell the browser did not convert: days since 1899-12-30.
    if (!Number.isInteger(value) || value < 1 || value > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  const text = toText(value);
  if (text === undefined) return undefined;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (match) return isoDate(pastYear(Number(match[3])), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s/.-]+([a-z]{3})[a-z]*\.?[\s/.,-]+(\d{2}|\d{4})$/i);
  if (match) {
    const month = MONTHS[(match[2] ?? '').toLowerCase()];
    return month ? isoDate(pastYear(Number(match[3])), month, Number(match[1])) : null;
  }
  match = text.match(/^([a-z]{3})[a-z]*\.?[\s/.-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s/.-]+(\d{2}|\d{4})$/i);
  if (match) {
    const month = MONTHS[(match[1] ?? '').toLowerCase()];
    return month ? isoDate(pastYear(Number(match[3])), month, Number(match[2])) : null;
  }
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One sheet row → a doctor to create, or `null` when the row has no usable
 * doctor's name. A cell that is not valid (bad email, half a date, an
 * over-long value) is left out; the rest of the row still imports.
 */
function parseRow(values: Record<string, unknown>): DoctorRow | null {
  const fullName = toText(values.fullName);
  if (!fullName || fullName.length < 2 || fullName.length > 150) return null;

  const text = (key: string, max: number) => {
    const value = toText(values[key]);
    return value !== undefined && value.length <= max ? value : undefined;
  };
  const row: DoctorRow = {
    fullName,
    mslNo: text('mslNo', 40),
    mslClass: text('mslClass', 20)?.toUpperCase(),
    specialization: text('specialization', 120),
    address: text('address', 500),
  };

  const areaText = toText(values.area);
  if (areaText !== undefined) {
    const { area, areaType } = splitArea(areaText);
    if (area !== undefined && area.length <= 120) row.area = area;
    row.areaType = areaType;
  }
  // A separate HQ/EX column wins over a type read off the area cell.
  const typeText = toText(values.areaType);
  if (typeText !== undefined) row.areaType = toAreaType(typeText) ?? row.areaType;

  const phoneText = toText(values.phone);
  if (phoneText !== undefined) {
    // "98765 43210 / 91234 56789" — keep the first number.
    const first = phoneText.split(/[,/;|&]/)[0]?.trim() ?? '';
    const digits = first.replace(/\D/g, '').length;
    if (digits >= 7 && digits <= 15 && first.length <= 20 && !/[a-z]/i.test(first)) row.phone = first;
  }

  const email = toText(values.email)?.toLowerCase();
  if (email !== undefined && EMAIL.test(email) && email.length <= 150) row.email = email;

  const today = toLocalDateString();
  for (const key of ['birthday', 'anniversary'] as const) {
    const date = toPersonalDate(values[key]);
    if (date && date <= today) row[key] = parseDateOnly(date);
  }

  return row;
}

/**
 * DoctorImportService — adds doctors from an MSL sheet in one go.
 *
 * Add-only: a row whose doctor's name and area match a doctor already on the
 * list (or an earlier row of the same file) is a duplicate and is skipped,
 * never merged. The caller gets back how many were added and skipped.
 */
export class DoctorImportService {
  private static instance: DoctorImportService | null = null;

  private constructor(
    private readonly doctors = DoctorRepository.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): DoctorImportService {
    if (!DoctorImportService.instance) {
      DoctorImportService.instance = new DoctorImportService();
    }
    return DoctorImportService.instance;
  }

  public async import(dto: ImportDoctorsDto, actorId: number) {
    const prisma = this.doctors.getPrisma();
    const summary = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.doctor.findMany({
          where: { deletedAt: null },
          select: { fullName: true, area: true },
        });
        const known = new Set(existing.map((doctor) => doctorDuplicateKey(doctor.fullName, doctor.area)));

        const toCreate: DoctorRow[] = [];
        let duplicates = 0;
        let invalid = 0;
        for (const input of dto.rows) {
          const row = parseRow(input.values);
          if (!row) {
            invalid += 1;
            continue;
          }
          const key = doctorDuplicateKey(row.fullName, row.area);
          if (known.has(key)) {
            duplicates += 1;
            continue;
          }
          known.add(key);
          toCreate.push(row);
        }

        // Production talks to a remote database, so write in bulk rather than a
        // round trip per row.
        let added = 0;
        for (let start = 0; start < toCreate.length; start += CREATE_CHUNK) {
          const created = await tx.doctor.createMany({
            data: toCreate
              .slice(start, start + CREATE_CHUNK)
              .map((row) => ({ ...row, createdBy: actorId, updatedBy: actorId })),
          });
          added += created.count;
        }

        return { total: dto.rows.length, added, duplicates, invalid };
      },
      { maxWait: 10_000, timeout: 180_000 },
    );

    await this.audits
      .log({
        userId: actorId,
        action: 'IMPORT',
        entity: 'Doctor',
        metadata: { ...summary, fileName: dto.fileName ?? null },
      })
      .catch(() => undefined);
    return { summary };
  }
}
