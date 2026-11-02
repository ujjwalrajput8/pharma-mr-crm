import type { Prisma } from '@prisma/client';
import { AppRoles, DoctorAreaTypes, type DoctorAreaType } from '../constants';
import type { ImportDoctorsDto } from '../dto/doctor.dto';
import { NotFoundError } from '../errors/AppError';
import { DoctorRepository } from '../repositories/DoctorRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuditService } from './AuditService';
import { parseDateOnly, toLocalDateString } from '../utils/datetime';

/** Text columns an import row may set, with the doctor form's length limits. */
const TEXT_FIELDS = {
  mslNo: 40,
  area: 120,
  fullName: 150,
  mslClass: 20,
  specialization: 120,
  address: 500,
} as const;

type TextField = keyof typeof TEXT_FIELDS;

const TEXT_LABEL: Record<TextField, string> = {
  mslNo: 'MSL No',
  area: 'Area',
  fullName: "Doctor's name",
  mslClass: 'MSL Class',
  specialization: 'Speciality',
  address: 'Address',
};
type DoctorField = TextField | 'areaType' | 'phone' | 'email' | 'birthday' | 'anniversary';
/** Dates travel as `YYYY-MM-DD` so they compare as plain strings. */
type FieldValue = string | null;
type DoctorFields = Partial<Record<DoctorField, FieldValue>>;

const DOCTOR_FIELDS: DoctorField[] = [
  'mslNo',
  'area',
  'areaType',
  'fullName',
  'phone',
  'mslClass',
  'specialization',
  'address',
  'email',
  'birthday',
  'anniversary',
];

/** In-memory copy of one doctor, advanced row by row as the plan is built. */
interface DoctorState {
  id: number | null;
  isNew: boolean;
  fields: Record<DoctorField, FieldValue>;
  mr: { id: number; fullName: string } | null;
}

type ImportOp =
  | { kind: 'create'; doctor: DoctorState; data: DoctorFields }
  | { kind: 'update'; doctor: DoctorState; data: DoctorFields }
  | { kind: 'assign'; doctor: DoctorState; mrId: number };

export interface DoctorImportRowResult {
  rowNumber: number;
  action: 'create' | 'update' | 'unchanged' | 'error';
  doctorId: number | null;
  doctorName: string | null;
  mslNo: string | null;
  matchedBy: 'mslNo' | 'mobile' | null;
  changes: Array<{ field: string; from: FieldValue; to: FieldValue }>;
  /** Cells that were skipped; the rest of the row still imports. */
  warnings: string[];
  /** Problems that keep the whole row out. */
  errors: string[];
}

interface Plan {
  rows: DoctorImportRowResult[];
  ops: ImportOp[][];
}

const lower = (value: string) => value.trim().toLowerCase();
/** "Dr. R.K. Sharma" and "dr rk sharma" are the same name. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/^dr\.?\s*/, '')
    .replace(/[^a-z0-9]/g, '');
/** Last ten digits, so "+91 98765-43210" and "9876543210" match. */
const phoneKey = (phone: string) => phone.replace(/\D/g, '').slice(-10);

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

const DATE_LABEL = { birthday: 'Birthday', anniversary: 'Anniversary' } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRow(values: Record<string, unknown>): {
  fields: DoctorFields;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const fields: DoctorFields = {};

  for (const [field, max] of Object.entries(TEXT_FIELDS) as Array<[TextField, number]>) {
    if (field === 'area') continue;
    const text = toText(values[field]);
    if (text === undefined) continue;
    if (text.length <= max) fields[field] = text;
    // MSL No and name identify the doctor, so a bad one keeps the row out.
    else if (field === 'mslNo' || field === 'fullName') {
      errors.push(`${TEXT_LABEL[field]} is longer than ${max} characters`);
    } else warnings.push(`${TEXT_LABEL[field]} is longer than ${max} characters — not saved`);
  }
  if (typeof fields.fullName === 'string' && fields.fullName.length < 2) {
    errors.push("Doctor's name must be at least 2 characters");
  }
  if (typeof fields.mslClass === 'string') fields.mslClass = fields.mslClass.toUpperCase();

  const areaText = toText(values.area);
  if (areaText !== undefined) {
    const { area, areaType } = splitArea(areaText);
    if (area !== undefined) {
      if (area.length <= TEXT_FIELDS.area) fields.area = area;
      else warnings.push(`${TEXT_LABEL.area} is longer than ${TEXT_FIELDS.area} characters — not saved`);
    }
    if (areaType) fields.areaType = areaType;
  }
  // A separate HQ/EX column wins over a type read off the area cell.
  const typeText = toText(values.areaType);
  if (typeText !== undefined) {
    const areaType = toAreaType(typeText);
    if (areaType) fields.areaType = areaType;
    else warnings.push(`HQ/EX "${typeText}" is not HQ, EX or OS — not saved`);
  }

  const phoneText = toText(values.phone);
  if (phoneText !== undefined) {
    const numbers = phoneText.split(/[,/;|&]/).map((part) => part.trim()).filter(Boolean);
    const first = numbers[0] ?? '';
    const digits = first.replace(/\D/g, '').length;
    if (digits < 7 || digits > 15 || first.length > 20 || /[a-z]/i.test(first)) {
      warnings.push(`Mobile "${phoneText}" is not a phone number — not saved`);
    } else {
      fields.phone = first;
      if (numbers.length > 1) warnings.push(`Only the first mobile number (${first}) was kept`);
    }
  }

  const email = toText(values.email)?.toLowerCase();
  if (email !== undefined) {
    if (EMAIL.test(email) && email.length <= 150) fields.email = email;
    else warnings.push(`Email "${email}" is not valid — not saved`);
  }

  const today = toLocalDateString();
  for (const key of ['birthday', 'anniversary'] as const) {
    const date = toPersonalDate(values[key]);
    if (date === undefined) continue;
    if (date === null) {
      warnings.push(`${DATE_LABEL[key]} "${String(values[key])}" is not a full date (use 15/08/1975) — not saved`);
    } else if (date > today) {
      warnings.push(`${DATE_LABEL[key]} ${date} is in the future — not saved`);
    } else {
      fields[key] = date;
    }
  }

  return { fields, warnings, errors };
}

/** Rows per multi-row INSERT. */
const CREATE_CHUNK = 500;

const toPrismaData = (data: DoctorFields) => {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    out[field] =
      (field === 'birthday' || field === 'anniversary') && value ? parseDateOnly(value) : value;
  }
  return out;
};

/**
 * DoctorImportService — bulk create / update of doctors from an MSL sheet.
 *
 * Like the medicine import, the whole file is planned against an in-memory
 * copy of the doctor list, so the preview and the real import share one code
 * path, and the commit re-plans inside its transaction.
 *
 * A row finds its doctor by MSL No, else by mobile + name. Only filled cells
 * overwrite; blank cells keep what is there.
 */
export class DoctorImportService {
  private static instance: DoctorImportService | null = null;

  private constructor(
    private readonly doctors = DoctorRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): DoctorImportService {
    if (!DoctorImportService.instance) {
      DoctorImportService.instance = new DoctorImportService();
    }
    return DoctorImportService.instance;
  }

  public async import(dto: ImportDoctorsDto, actorId: number) {
    let mr: { id: number; fullName: string } | null = null;
    if (dto.mrId) {
      const user = await this.users.findById(dto.mrId);
      if (!user || user.role !== AppRoles.MR) {
        throw new NotFoundError('Medical Representative not found');
      }
      mr = { id: user.id, fullName: user.fullName };
    }

    const prisma = this.doctors.getPrisma();
    if (dto.dryRun) {
      return this.toResult(await this.plan(dto, mr, prisma), true);
    }

    const plan = await prisma.$transaction(
      async (tx) => {
        const planned = await this.plan(dto, mr, tx);
        await this.commit(planned, actorId, tx);
        return planned;
      },
      { maxWait: 10_000, timeout: 180_000 },
    );

    const result = this.toResult(plan, false);
    await this.audits
      .log({
        userId: actorId,
        action: 'IMPORT',
        entity: 'Doctor',
        metadata: { ...result.summary, fileName: dto.fileName ?? null, mrId: dto.mrId ?? null },
      })
      .catch(() => undefined);
    return result;
  }

  private toResult(plan: Plan, dryRun: boolean) {
    const count = (action: DoctorImportRowResult['action']) =>
      plan.rows.filter((row) => row.action === action).length;
    return {
      dryRun,
      summary: {
        total: plan.rows.length,
        create: count('create'),
        update: count('update'),
        unchanged: count('unchanged'),
        error: count('error'),
        /** Rows that import with one or more cells skipped. */
        warning: plan.rows.filter((row) => row.action !== 'error' && row.warnings.length > 0).length,
      },
      rows: plan.rows,
    };
  }

  private async plan(
    dto: ImportDoctorsDto,
    mr: { id: number; fullName: string } | null,
    client: Prisma.TransactionClient,
  ): Promise<Plan> {
    const existing = await client.doctor.findMany({
      where: { deletedAt: null },
      include: {
        assignments: {
          where: { isActive: true, deletedAt: null },
          include: { mr: { select: { id: true, fullName: true } } },
        },
      },
    });

    const byMslNo = new Map<string, DoctorState>();
    const byPhoneName = new Map<string, DoctorState[]>();
    const index = (state: DoctorState) => {
      const { mslNo, phone, fullName } = state.fields;
      if (mslNo) byMslNo.set(lower(mslNo), state);
      if (phone && fullName) {
        const key = `${phoneKey(phone)}|${nameKey(fullName)}`;
        const list = byPhoneName.get(key) ?? [];
        if (!list.includes(state)) list.push(state);
        byPhoneName.set(key, list);
      }
    };

    for (const doctor of existing) {
      const fields = {} as Record<DoctorField, FieldValue>;
      for (const field of DOCTOR_FIELDS) {
        const value = doctor[field];
        fields[field] = value instanceof Date ? value.toISOString().slice(0, 10) : (value ?? null);
      }
      index({
        id: doctor.id,
        isNew: false,
        fields,
        mr: doctor.assignments[0]?.mr ?? null,
      });
    }

    const rows: DoctorImportRowResult[] = [];
    const ops: ImportOp[][] = [];
    /** Doctor → first row that touched it, to catch the same doctor twice. */
    const seen = new Map<DoctorState, number>();

    for (const input of dto.rows) {
      const { fields, warnings, errors } = parseRow(input.values);
      const result: DoctorImportRowResult = {
        rowNumber: input.rowNumber,
        action: 'error',
        doctorId: null,
        doctorName: fields.fullName ?? null,
        mslNo: fields.mslNo ?? null,
        matchedBy: null,
        changes: [],
        warnings,
        errors,
      };
      const rowOps: ImportOp[] = [];
      rows.push(result);
      ops.push(rowOps);

      const { mslNo, fullName, phone } = fields;
      if (!mslNo && !fullName) errors.push("Row needs a doctor's name or MSL No");
      if (errors.length > 0) continue;

      // ── Find the doctor this row is about ───────────────────────────────────
      let target: DoctorState | undefined;
      if (mslNo && byMslNo.has(lower(mslNo))) {
        target = byMslNo.get(lower(mslNo));
        result.matchedBy = 'mslNo';
      } else if (phone && fullName) {
        const candidates = byPhoneName.get(`${phoneKey(phone)}|${nameKey(fullName)}`) ?? [];
        if (candidates.length > 1) {
          errors.push(
            `${candidates.length} doctors named "${fullName}" share this mobile — add the MSL No to pick one`,
          );
          continue;
        }
        target = candidates[0];
        if (target) result.matchedBy = 'mobile';
      }

      if (target) {
        // A mobile match must not silently re-number a doctor who has their own MSL No.
        if (mslNo && target.fields.mslNo && lower(target.fields.mslNo) !== lower(mslNo)) {
          errors.push(
            `Matches ${target.fields.fullName} by mobile, but their MSL No is ${target.fields.mslNo}`,
          );
        }
        const firstRow = seen.get(target);
        if (firstRow !== undefined) errors.push(`Same doctor as row ${firstRow}`);
      } else if (!fullName) {
        errors.push(`MSL No ${mslNo} is not on the doctor list — a new doctor needs a name`);
      }
      if (errors.length > 0) continue;

      // ── Work out what changes ───────────────────────────────────────────────
      const doctor: DoctorState = target ?? {
        id: null,
        isNew: true,
        fields: Object.fromEntries(DOCTOR_FIELDS.map((field) => [field, null])) as Record<
          DoctorField,
          FieldValue
        >,
        mr: null,
      };

      const fieldChanges: DoctorFields = {};
      for (const field of DOCTOR_FIELDS) {
        const next = fields[field];
        if (next === undefined) continue; // blank cell: keep what is there
        const current = doctor.fields[field];
        const same =
          next === null || current === null
            ? next === current
            : field === 'mslNo'
              ? lower(next) === lower(current)
              : field === 'phone'
                ? phoneKey(next) === phoneKey(current)
                : next === current;
        if (!same) {
          fieldChanges[field] = next;
          result.changes.push({ field, from: current, to: next });
        }
      }

      if (mr && doctor.mr?.id !== mr.id) {
        result.changes.push({ field: 'mr', from: doctor.mr?.fullName ?? null, to: mr.fullName });
      }

      // ── Commit the row to state and queue its writes ─────────────────────────
      seen.set(doctor, input.rowNumber);
      if (!target) {
        rowOps.push({ kind: 'create', doctor, data: fieldChanges });
      } else if (Object.keys(fieldChanges).length > 0) {
        rowOps.push({ kind: 'update', doctor, data: fieldChanges });
      }
      Object.assign(doctor.fields, fieldChanges);
      index(doctor);

      if (mr && doctor.mr?.id !== mr.id) {
        rowOps.push({ kind: 'assign', doctor, mrId: mr.id });
        doctor.mr = mr;
      }

      result.doctorId = doctor.id;
      result.doctorName = doctor.fields.fullName;
      result.mslNo = doctor.fields.mslNo;
      result.action = !target ? 'create' : rowOps.length > 0 ? 'update' : 'unchanged';
    }

    return { rows, ops };
  }

  /**
   * Writes the plan in bulk. Production talks to a remote database, so one
   * round trip per row would push a 2,000-row file past the transaction timeout.
   */
  private async commit(plan: Plan, actorId: number, tx: Prisma.TransactionClient): Promise<void> {
    const live = plan.rows.flatMap((row, index) =>
      row.action === 'error' ? [] : (plan.ops[index] ?? []).map((op) => ({ row, op })),
    );

    const creates = live.flatMap(({ row, op }) => (op.kind === 'create' ? [{ row, op }] : []));
    for (let start = 0; start < creates.length; start += CREATE_CHUNK) {
      const chunk = creates.slice(start, start + CREATE_CHUNK);
      const created = await tx.doctor.createManyAndReturn({
        data: chunk.map(({ op }) => ({
          ...(toPrismaData(op.data) as Prisma.DoctorCreateManyInput),
          createdBy: actorId,
          updatedBy: actorId,
        })),
        select: { id: true },
      });
      // Postgres hands a multi-row INSERT's rows back in VALUES order. Every new
      // doctor gets the same MR, so the assignment below only needs the id set.
      chunk.forEach(({ row, op }, index) => {
        op.doctor.id = created[index]?.id ?? null;
        row.doctorId = op.doctor.id;
      });
    }

    for (const { op } of live) {
      if (op.kind !== 'update') continue;
      await tx.doctor.update({
        where: { id: op.doctor.id! },
        data: { ...(toPrismaData(op.data) as Prisma.DoctorUncheckedUpdateInput), updatedBy: actorId },
      });
    }

    const assigns = live.flatMap(({ op }) => (op.kind === 'assign' ? [op] : []));
    const mrId = assigns[0]?.mrId;
    if (mrId !== undefined) {
      await this.doctors.assignMrToMany(
        assigns.map((op) => op.doctor.id!),
        mrId,
        actorId,
        tx,
      );
    }
  }
}
