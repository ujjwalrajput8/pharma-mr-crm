import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppRoles, StockTxnTypes, UserStatuses } from '../constants';
import type {
  BulkVisitDto,
  CorrectVisitDto,
  ListVisitsQueryDto,
  LookupDoctorsQueryDto,
  ReviewVisitDto,
  SampleCorrectionDto,
  VisitProductInput,
  VisitSampleInput,
} from '../dto/visit.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { SettingRepository } from '../repositories/SettingRepository';
import type { AuthUser } from '../types/auth.types';
import { addDays, formatDateOnly, parseDateOnly, todayDateOnly } from '../utils/datetime';
import { AuditService } from './AuditService';
import { DoctorAssignmentService } from './DoctorAssignmentService';
import { NotificationService } from './NotificationService';
import { StockLedgerService } from './StockLedgerService';
import { TeamScopeService } from './TeamScopeService';

type Tx = Prisma.TransactionClient;
export type VisitSourceValue = 'APPOINTMENT' | 'DIRECT';

const OPEN_APPOINTMENT = ['PENDING', 'RESCHEDULED', 'REQUESTED', 'CONFIRMED'] as const;
/** Manager / Admin may log or correct this far back (D1); an MR has `visit.backDateDays`. */
const MANAGER_BACK_DAYS = 30;
const DEFAULT_MR_BACK_DAYS = 2;
/** Advisory-lock class for "one visit per MR + doctor + day" (Prisma's own lock is 0 / 72707369). */
const VISIT_LOCK_CLASS = 8143;
const TX_OPTIONS = { timeout: 20_000, maxWait: 20_000 };

function parseTime(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0));
}
function formatTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}
function minutesBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  const diff = toMin(to) - toMin(from);
  return diff > 0 ? diff : null;
}
function niceDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

/** Everything a visit form sends, whatever the door it came through. */
export interface RecordVisitInput {
  doctorId: number;
  mrId?: number;
  visitDate: string;
  visitTime: string;
  checkInTime?: string;
  checkOutTime?: string;
  purpose?: string;
  discussionNotes?: string;
  doctorFeedback?: string;
  visitOutcome?: string;
  nextFollowUp?: string | null;
  remarks?: string;
  products?: VisitProductInput[];
  medicineIds?: number[];
  samples?: VisitSampleInput[];
  latitude?: number;
  longitude?: number;
  clientUuid?: string;
}

interface SampleAllocation {
  medicineId: number;
  medicineName: string;
  batchId: number;
  batchNo: string;
  qty: number;
  remarks?: string;
}

const doctorSelect = {
  id: true,
  fullName: true,
  mslNo: true,
  mslClass: true,
  specialization: true,
  area: true,
  address: true,
} as const;

const visitInclude = {
  doctor: { select: doctorSelect },
  mr: { select: { id: true, fullName: true, email: true, photoUrl: true } },
  offListReviewedBy: { select: { id: true, fullName: true } },
  appointment: { select: { id: true, date: true, time: true, purpose: true, status: true } },
  products: {
    where: { deletedAt: null },
    include: { medicine: { select: { id: true, name: true } } },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.VisitInclude;

type VisitRow = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

/**
 * VisitService — the single rules engine for visits.
 *
 * Every door (direct log, appointment completion, bulk) goes through `record()`:
 * one visit per MR + doctor + day (advisory lock + check, safe under concurrent
 * requests), no future dates, back-date window by role, samples from the MR's own
 * bag (earliest expiry first, atomic), unlisted doctors flagged — never assigned —
 * and an audit entry in the same transaction. Visits are never deleted; they are
 * corrected (with a reason) and their samples corrected through the ledger.
 */
export class VisitService {
  private static instance: VisitService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
    private readonly audits = AuditService.getInstance(),
    private readonly notifications = NotificationService.getInstance(),
    private readonly settings = SettingRepository.getInstance(),
    private readonly assignments = DoctorAssignmentService.getInstance(),
  ) {}

  public static getInstance(): VisitService {
    if (!VisitService.instance) {
      VisitService.instance = new VisitService();
    }
    return VisitService.instance;
  }

  // ── Record ──────────────────────────────────────────────────────────────

  public async record(
    input: RecordVisitInput,
    actor: AuthUser,
    options: { source: VisitSourceValue; appointmentId?: number; bulkRunId?: string },
  ): Promise<{ visitId: number; replayed: boolean; offList: boolean; appointmentId: number | null }> {
    const target = await this.resolveTarget(actor, input.mrId);
    const visitDate = parseDateOnly(input.visitDate);
    await this.assertDateAllowed(actor, visitDate);
    const doctor = await this.requireActiveDoctor(input.doctorId);

    if (input.clientUuid) {
      const earlier = await this.prisma.visit.findUnique({
        where: { clientUuid: input.clientUuid },
        select: { id: true, mrId: true, offList: true, appointmentId: true },
      });
      if (earlier) return this.replay(earlier, target.id);
    }

    const assigned = await this.prisma.doctorAssignment.findFirst({
      where: { doctorId: doctor.id, mrId: target.id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const offList = !assigned;
    const allocations = await this.allocateSamples(target.id, input.samples ?? [], visitDate);
    const products = this.productRows(input);

    let outcome: { visitId: number; appointmentId: number | null } | { replay: { id: number; mrId: number; offList: boolean; appointmentId: number | null } };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        await this.lockSlot(tx, target.id, doctor.id, input.visitDate);
        if (input.clientUuid) {
          const again = await tx.visit.findUnique({
            where: { clientUuid: input.clientUuid },
            select: { id: true, mrId: true, offList: true, appointmentId: true },
          });
          if (again) return { replay: again };
        }
        const duplicate = await tx.visit.findFirst({
          where: { mrId: target.id, doctorId: doctor.id, visitDate, deletedAt: null },
          select: { id: true },
        });
        if (duplicate) {
          throw new ConflictError(
            `${doctor.fullName} already has a visit on ${niceDate(visitDate)} — open it or correct it instead`,
            { existingVisitId: duplicate.id },
          );
        }

        let appointmentId: number | null = options.appointmentId ?? null;
        if (appointmentId) {
          const { count } = await tx.appointment.updateMany({
            where: { id: appointmentId, deletedAt: null, status: { in: [...OPEN_APPOINTMENT] } },
            data: { status: 'COMPLETED', updatedBy: actor.id },
          });
          if (count === 0) throw new ConflictError('Appointment is already completed');
        } else {
          // A same-day appointment with this doctor is the visit that just happened.
          const sameDay = await tx.appointment.findFirst({
            where: {
              mrId: target.id,
              doctorId: doctor.id,
              date: visitDate,
              deletedAt: null,
              status: { in: [...OPEN_APPOINTMENT] },
              visit: { is: null },
            },
            orderBy: { time: 'asc' },
            select: { id: true },
          });
          if (sameDay) {
            const { count } = await tx.appointment.updateMany({
              where: { id: sameDay.id, status: { in: [...OPEN_APPOINTMENT] } },
              data: { status: 'COMPLETED', updatedBy: actor.id },
            });
            if (count === 1) appointmentId = sameDay.id;
          }
        }

        const visit = await tx.visit.create({
          data: {
            appointmentId,
            doctorId: doctor.id,
            mrId: target.id,
            visitDate,
            visitTime: parseTime(input.visitTime),
            checkInTime: parseTime(input.checkInTime ?? input.visitTime),
            checkOutTime: input.checkOutTime ? parseTime(input.checkOutTime) : null,
            meetingDurationMin: minutesBetween(input.checkInTime ?? input.visitTime, input.checkOutTime),
            purpose: input.purpose ?? null,
            discussionNotes: input.discussionNotes ?? null,
            doctorFeedback: input.doctorFeedback ?? null,
            visitOutcome: input.visitOutcome ?? null,
            nextFollowUp: input.nextFollowUp ? parseDateOnly(input.nextFollowUp) : null,
            remarks: input.remarks ?? null,
            inLat: input.latitude ?? null,
            inLng: input.longitude ?? null,
            clientUuid: input.clientUuid ?? null,
            source: options.source,
            offList,
            createdBy: actor.id,
            updatedBy: actor.id,
            products: {
              create: products.map((p) => ({ ...p, createdBy: actor.id, updatedBy: actor.id })),
            },
          },
          select: { id: true },
        });

        for (const [index, a] of allocations.entries()) {
          await this.ledger.giveSample({
            mrId: target.id,
            doctorId: doctor.id,
            medicineId: a.medicineId,
            batchId: a.batchId,
            qty: a.qty,
            visitId: visit.id,
            txnDate: visitDate,
            note: a.remarks,
            createdBy: actor.id,
            clientUuid: input.clientUuid ? `${input.clientUuid}:${index}` : undefined,
            client: tx,
          });
        }

        await this.audits.log(
          {
            userId: actor.id,
            action: 'VISIT_CREATED',
            entity: 'Visit',
            entityId: String(visit.id),
            after: {
              source: options.source,
              mrId: target.id,
              doctorId: doctor.id,
              visitDate: input.visitDate,
              appointmentId,
              offList,
              samples: allocations.map((a) => ({ medicineId: a.medicineId, batchId: a.batchId, qty: a.qty })),
            },
            metadata: {
              doctor: doctor.fullName,
              mr: target.fullName,
              ...(options.bulkRunId ? { bulkRunId: options.bulkRunId } : {}),
            },
          },
          tx,
        );
        return { visitId: visit.id, appointmentId };
      }, TX_OPTIONS);
    } catch (error) {
      throw this.friendlyWriteError(error);
    }

    if ('replay' in outcome) return this.replay(outcome.replay, target.id);

    if (offList && target.managerId) {
      await this.notifications
        .create({
          userId: target.managerId,
          kind: 'VISIT_UNLISTED',
          title: `${target.fullName} logged an unlisted visit`,
          message: `${doctor.fullName} is not in ${target.fullName}'s doctor list — review it.`,
          href: '/visits?view=unlisted',
          tone: 'warning',
        })
        .catch(() => undefined);
    }
    return { visitId: outcome.visitId, replayed: false, offList, appointmentId: outcome.appointmentId };
  }

  /** Bulk: one DIRECT visit per doctor, each in its own transaction (partial success). */
  public async bulk(dto: BulkVisitDto, actor: AuthUser) {
    const target = await this.resolveTarget(actor, dto.mrId);
    const visitDate = parseDateOnly(dto.visitDate);
    await this.assertDateAllowed(actor, visitDate);
    const ids = [...new Set(dto.doctorIds)];

    const [doctors, assigned, visited] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, fullName: true, mslNo: true, area: true, status: true },
      }),
      this.prisma.doctorAssignment.findMany({
        where: { doctorId: { in: ids }, mrId: target.id, isActive: true, deletedAt: null },
        select: { doctorId: true },
      }),
      this.prisma.visit.findMany({
        where: { doctorId: { in: ids }, mrId: target.id, visitDate, deletedAt: null },
        select: { doctorId: true, id: true },
      }),
    ]);
    const byId = new Map(doctors.map((d) => [d.id, d]));
    const assignedSet = new Set(assigned.map((a) => a.doctorId));
    const visitedMap = new Map(visited.map((v) => [v.doctorId, v.id]));

    type Row = {
      doctorId: number;
      doctorName: string | null;
      mslNo: string | null;
      area: string | null;
      status: 'READY' | 'ALREADY_VISITED' | 'UNLISTED' | 'INVALID' | 'CREATED' | 'FAILED';
      reason: string | null;
      visitId: number | null;
    };
    const rows: Row[] = ids.map((id) => {
      const d = byId.get(id);
      const base = { doctorId: id, doctorName: d?.fullName ?? null, mslNo: d?.mslNo ?? null, area: d?.area ?? null, visitId: null };
      if (!d) return { ...base, status: 'INVALID', reason: 'Doctor not found' };
      if (d.status !== 'ACTIVE') return { ...base, status: 'INVALID', reason: 'Doctor is inactive' };
      if (visitedMap.has(id)) {
        return { ...base, status: 'ALREADY_VISITED', reason: `Already visited on ${niceDate(visitDate)}`, visitId: visitedMap.get(id)! };
      }
      if (!assignedSet.has(id)) {
        return { ...base, status: 'UNLISTED', reason: `Not in ${target.fullName}'s list — log it on its own` };
      }
      return { ...base, status: 'READY', reason: null };
    });

    const summarise = () => ({
      total: rows.length,
      ready: rows.filter((r) => r.status === 'READY').length,
      created: rows.filter((r) => r.status === 'CREATED').length,
      skipped: rows.filter((r) => ['ALREADY_VISITED', 'UNLISTED', 'INVALID'].includes(r.status)).length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
    });
    if (dto.dryRun) return { dryRun: true, mr: { id: target.id, fullName: target.fullName }, rows, summary: summarise() };

    const bulkRunId = randomUUID();
    for (const row of rows) {
      if (row.status !== 'READY') continue;
      try {
        const result = await this.record(
          {
            doctorId: row.doctorId,
            mrId: target.id,
            visitDate: dto.visitDate,
            visitTime: dto.visitTime,
            purpose: dto.purpose,
            discussionNotes: dto.discussionNotes,
            remarks: dto.remarks,
            products: dto.products,
            samples: [],
          },
          actor,
          { source: 'DIRECT', bulkRunId },
        );
        row.status = 'CREATED';
        row.visitId = result.visitId;
      } catch (error) {
        row.status = 'FAILED';
        row.reason = error instanceof Error ? error.message : 'Could not save';
        const existing = (error as { details?: { existingVisitId?: number } }).details?.existingVisitId;
        if (existing) row.visitId = existing;
      }
    }
    return { dryRun: false, bulkRunId, mr: { id: target.id, fullName: target.fullName }, rows, summary: summarise() };
  }

  // ── Read ────────────────────────────────────────────────────────────────

  public async list(query: ListVisitsQueryDto, actor: AuthUser) {
    const base = await this.listWhere(query, actor);
    const where: Prisma.VisitWhereInput = {
      ...base,
      ...(query.source ? { source: query.source } : {}),
      ...(query.offList !== undefined ? { offList: query.offList } : {}),
      ...(query.reviewed !== undefined
        ? { offListReviewedAt: query.reviewed ? { not: null } : null }
        : {}),
      ...(query.corrected !== undefined
        ? { lastCorrectedAt: query.corrected ? { not: null } : null }
        : {}),
    };
    const [items, total, all, direct, fromAppointment, unlistedPending] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: [{ visitDate: 'desc' }, { visitTime: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: visitInclude,
      }),
      this.prisma.visit.count({ where }),
      this.prisma.visit.count({ where: base }),
      this.prisma.visit.count({ where: { ...base, source: 'DIRECT' } }),
      this.prisma.visit.count({ where: { ...base, source: 'APPOINTMENT' } }),
      this.prisma.visit.count({ where: { ...base, offList: true, offListReviewedAt: null } }),
    ]);
    const samples = await this.samplesFor(items.map((v) => v.id));
    const flags = await this.flagsFor(actor);
    return {
      items: items.map((v) => this.toPublic(v, samples.get(v.id) ?? [], flags)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        counts: { all, direct, fromAppointment, unlistedPending },
      },
    };
  }

  public async get(id: number, actor: AuthUser) {
    const visit = await this.requireVisible(id, actor);
    const samples = await this.samplesFor([visit.id]);
    return this.toPublic(visit, samples.get(visit.id) ?? [], await this.flagsFor(actor));
  }

  /** Corrections, sample corrections and reviews — oldest first. */
  public async history(id: number, actor: AuthUser) {
    await this.requireVisible(id, actor);
    const rows = await this.prisma.auditLog.findMany({
      where: { entity: 'Visit', entityId: String(id) },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        before: true,
        after: true,
        reason: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, fullName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      at: row.createdAt,
      by: row.user,
      before: row.before,
      after: row.after,
      reason: row.reason,
      metadata: row.metadata,
    }));
  }

  /** "Search all doctors" for the visit form — a small projection, active only. */
  public async lookupDoctors(query: LookupDoctorsQueryDto) {
    const term = query.q;
    const doctors = await this.prisma.doctor.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { area: { contains: term, mode: 'insensitive' } },
          { specialization: { contains: term, mode: 'insensitive' } },
          { mslNo: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        ...doctorSelect,
        assignments: {
          where: { isActive: true, deletedAt: null },
          select: { mr: { select: { id: true, fullName: true } } },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
      take: query.limit,
    });
    return doctors.map(({ assignments, ...d }) => ({ ...d, assignedMr: assignments[0]?.mr ?? null }));
  }

  // ── Correct ─────────────────────────────────────────────────────────────

  public async correct(id: number, dto: CorrectVisitDto, actor: AuthUser) {
    const visit = await this.requireVisible(id, actor);
    const today = todayDateOnly();
    if (actor.role === AppRoles.MR) {
      if (visit.mrId !== actor.id) throw new ForbiddenError('You can only correct your own visits');
      const back = await this.backDateDays();
      if (visit.visitDate < addDays(today, -back)) {
        throw new ForbiddenError(`Visits older than ${back} days are corrected by your manager`);
      }
      if (dto.visitDate !== undefined || dto.doctorId !== undefined) {
        throw new ForbiddenError('Only a manager or admin can change the date or the doctor');
      }
    }

    const current = this.correctable(visit);
    const next: Record<string, unknown> = {};
    const fields = ['visitTime', 'checkInTime', 'checkOutTime', 'purpose', 'discussionNotes', 'doctorFeedback', 'visitOutcome', 'nextFollowUp', 'remarks', 'visitDate', 'doctorId'] as const;
    for (const field of fields) {
      if (dto[field] === undefined) continue;
      const value = dto[field] ?? null;
      if (value !== current[field]) next[field] = value;
    }
    const productsChanged =
      dto.products !== undefined &&
      JSON.stringify(this.productKey(dto.products)) !== JSON.stringify(this.productKey(current.products));
    if (Object.keys(next).length === 0 && !productsChanged) throw new BadRequestError('Nothing changed');

    const merged = { ...current, ...next } as typeof current;
    if (merged.checkInTime && merged.checkOutTime && merged.checkOutTime < merged.checkInTime) {
      throw new BadRequestError('Check-out cannot be before check-in');
    }
    if (merged.purpose === 'OTHER' && (merged.remarks ?? '').trim().length < 3) {
      throw new BadRequestError('Say what the visit was for (purpose "Other")');
    }
    const newDate = next.visitDate !== undefined ? parseDateOnly(String(next.visitDate)) : visit.visitDate;
    const newDoctorId = (next.doctorId as number | undefined) ?? visit.doctorId;
    if (next.visitDate !== undefined) await this.assertDateAllowed(actor, newDate);
    let offList = visit.offList;
    if (next.doctorId !== undefined) {
      await this.requireActiveDoctor(newDoctorId!);
      const samples = await this.samplesFor([visit.id]);
      if ((samples.get(visit.id) ?? []).some((s) => s.quantity > 0)) {
        throw new BadRequestError('Samples were given on this visit — correct the samples first, then the doctor');
      }
      const assigned = await this.prisma.doctorAssignment.findFirst({
        where: { doctorId: newDoctorId!, mrId: visit.mrId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      offList = !assigned;
    }

    const before = Object.fromEntries(Object.keys(next).map((k) => [k, current[k as keyof typeof current]]));
    if (productsChanged) before.products = current.products;
    const after: Record<string, unknown> = { ...next, ...(productsChanged ? { products: this.productKey(dto.products!) } : {}) };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (next.visitDate !== undefined || next.doctorId !== undefined) {
          await this.lockSlot(tx, visit.mrId, newDoctorId!, formatDateOnly(newDate));
          const clash = await tx.visit.findFirst({
            where: { id: { not: visit.id }, mrId: visit.mrId, doctorId: newDoctorId, visitDate: newDate, deletedAt: null },
            select: { id: true },
          });
          if (clash) {
            throw new ConflictError(`That doctor already has a visit on ${niceDate(newDate)}`, { existingVisitId: clash.id });
          }
        }
        await tx.visit.update({
          where: { id: visit.id },
          data: {
            ...(next.visitTime !== undefined ? { visitTime: parseTime(String(next.visitTime)) } : {}),
            ...(next.checkInTime !== undefined ? { checkInTime: next.checkInTime ? parseTime(String(next.checkInTime)) : null } : {}),
            ...(next.checkOutTime !== undefined ? { checkOutTime: next.checkOutTime ? parseTime(String(next.checkOutTime)) : null } : {}),
            ...(next.checkInTime !== undefined || next.checkOutTime !== undefined
              ? { meetingDurationMin: minutesBetween(merged.checkInTime ?? merged.visitTime ?? undefined, merged.checkOutTime ?? undefined) }
              : {}),
            ...(next.purpose !== undefined ? { purpose: next.purpose as string | null } : {}),
            ...(next.discussionNotes !== undefined ? { discussionNotes: next.discussionNotes as string | null } : {}),
            ...(next.doctorFeedback !== undefined ? { doctorFeedback: next.doctorFeedback as string | null } : {}),
            ...(next.visitOutcome !== undefined ? { visitOutcome: next.visitOutcome as string | null } : {}),
            ...(next.remarks !== undefined ? { remarks: next.remarks as string | null } : {}),
            ...(next.nextFollowUp !== undefined ? { nextFollowUp: next.nextFollowUp ? parseDateOnly(String(next.nextFollowUp)) : null } : {}),
            ...(next.visitDate !== undefined ? { visitDate: newDate } : {}),
            ...(next.doctorId !== undefined
              ? {
                  doctorId: newDoctorId,
                  offList,
                  ...(offList ? { offListReviewedAt: null, offListReviewedById: null, offListReviewAction: null, offListReviewNote: null } : {}),
                }
              : {}),
            lastCorrectedAt: new Date(),
            updatedBy: actor.id,
          },
        });
        if (productsChanged) {
          const wanted = new Map(this.productRows({ products: dto.products } as RecordVisitInput).map((p) => [p.medicineId, p]));
          await tx.visitProduct.updateMany({
            where: { visitId: visit.id, deletedAt: null, medicineId: { notIn: [...wanted.keys()] } },
            data: { deletedAt: new Date(), updatedBy: actor.id },
          });
          for (const p of wanted.values()) {
            await tx.visitProduct.upsert({
              where: { visitId_medicineId: { visitId: visit.id, medicineId: p.medicineId } },
              create: { visitId: visit.id, ...p, createdBy: actor.id, updatedBy: actor.id },
              update: { ...p, deletedAt: null, updatedBy: actor.id },
            });
          }
        }
        await this.audits.log(
          {
            userId: actor.id,
            action: 'VISIT_CORRECTED',
            entity: 'Visit',
            entityId: String(visit.id),
            before: before as Prisma.InputJsonValue,
            after: after as Prisma.InputJsonValue,
            reason: dto.reason,
          },
          tx,
        );
      }, TX_OPTIONS);
    } catch (error) {
      throw this.friendlyWriteError(error);
    }
    return this.get(visit.id, actor);
  }

  public async sampleCorrection(id: number, dto: SampleCorrectionDto, actor: AuthUser) {
    if (actor.role === AppRoles.MR) throw new ForbiddenError('Ask your manager to correct samples');
    const visit = await this.requireVisible(id, actor);
    if (!visit.doctorId) throw new BadRequestError('This visit has no doctor — samples cannot be corrected');
    const doctorId = visit.doctorId;
    const lines = (await this.samplesFor([visit.id])).get(visit.id) ?? [];
    const netOf = (medicineId: number, batchId: number) =>
      lines.find((l) => l.medicineId === medicineId && l.batchId === batchId)?.quantity ?? 0;

    // Resolve each line to a batch and check it against what was handed over.
    const takenBack = new Map<string, number>();
    const plan: Array<{ kind: 'RETURN' | 'LOST'; medicineId: number; batchId: number; qty: number } | { kind: 'GIVE'; medicineId: number; batchId?: number; qty: number }> = [];
    for (const line of dto.lines) {
      if (line.action === 'ADD_GIVEN') {
        plan.push({ kind: 'GIVE', medicineId: line.medicineId, batchId: line.batchId, qty: line.quantity });
        continue;
      }
      const given = lines.filter((l) => l.medicineId === line.medicineId && l.quantity > 0);
      if (given.length === 0) throw new BadRequestError(`${await this.medicineName(line.medicineId)} was not given on this visit`);
      const batchId = line.batchId ?? (given.length === 1 ? given[0]!.batchId : undefined);
      if (!batchId) throw new BadRequestError('Pick the batch to correct — several batches were given');
      const key = `${line.medicineId}:${batchId}`;
      const already = takenBack.get(key) ?? 0;
      const net = netOf(line.medicineId, batchId);
      if (already + line.quantity > net) {
        throw new BadRequestError(
          `Only ${net - already} of ${await this.medicineName(line.medicineId)} (that batch) are left on this visit`,
        );
      }
      takenBack.set(key, already + line.quantity);
      plan.push({ kind: line.action === 'RETURN_TO_BAG' ? 'RETURN' : 'LOST', medicineId: line.medicineId, batchId, qty: line.quantity });
    }
    const gives = plan.filter((p): p is { kind: 'GIVE'; medicineId: number; batchId?: number; qty: number } => p.kind === 'GIVE');
    const allocations = await this.allocateSamples(
      visit.mrId,
      gives.map((g) => ({ medicineId: g.medicineId, quantity: g.qty, batchId: g.batchId })),
      todayDateOnly(),
    );

    const txnDate = todayDateOnly();
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const p of plan) {
          if (p.kind === 'GIVE') continue;
          await this.ledger.correctSample({
            kind: p.kind,
            mrId: visit.mrId,
            doctorId,
            medicineId: p.medicineId,
            batchId: p.batchId,
            qty: p.qty,
            visitId: visit.id,
            txnDate,
            note: dto.reason,
            createdBy: actor.id,
            client: tx,
          });
        }
        for (const a of allocations) {
          await this.ledger.giveSample({
            mrId: visit.mrId,
            doctorId,
            medicineId: a.medicineId,
            batchId: a.batchId,
            qty: a.qty,
            visitId: visit.id,
            txnDate,
            note: dto.reason,
            createdBy: actor.id,
            client: tx,
          });
        }
        await this.audits.log(
          {
            userId: actor.id,
            action: 'VISIT_SAMPLE_CORRECTED',
            entity: 'Visit',
            entityId: String(visit.id),
            before: { samples: lines.map((l) => ({ medicineId: l.medicineId, batchId: l.batchId, qty: l.quantity })) },
            after: {
              lines: [
                ...plan.filter((p) => p.kind !== 'GIVE').map((p) => ({ action: p.kind === 'RETURN' ? 'RETURN_TO_BAG' : 'WRITE_OFF', medicineId: p.medicineId, batchId: (p as { batchId: number }).batchId, qty: p.qty })),
                ...allocations.map((a) => ({ action: 'ADD_GIVEN', medicineId: a.medicineId, batchId: a.batchId, qty: a.qty })),
              ],
            },
            reason: dto.reason,
          },
          tx,
        );
      }, TX_OPTIONS);
    } catch (error) {
      throw this.friendlyWriteError(error);
    }
    return this.get(visit.id, actor);
  }

  public async review(id: number, dto: ReviewVisitDto, actor: AuthUser) {
    if (actor.role === AppRoles.MR) throw new ForbiddenError('Only a manager or admin reviews unlisted visits');
    const visit = await this.requireVisible(id, actor);
    if (!visit.offList) throw new BadRequestError('This visit is not unlisted');
    if (visit.offListReviewedAt) throw new ConflictError('This visit is already reviewed');
    if (dto.action === 'ASSIGN' && !visit.doctorId) throw new BadRequestError('This visit has no doctor');

    const mark = async (tx: Tx) => {
      const { count } = await tx.visit.updateMany({
        where: { id: visit.id, offListReviewedAt: null },
        data: {
          offListReviewedAt: new Date(),
          offListReviewedById: actor.id,
          offListReviewAction: dto.action === 'ASSIGN' ? 'ASSIGNED' : 'REVIEWED',
          offListReviewNote: dto.note || null,
        },
      });
      if (count === 0) throw new ConflictError('This visit is already reviewed');
      await this.audits.log(
        {
          userId: actor.id,
          action: 'VISIT_REVIEWED',
          entity: 'Visit',
          entityId: String(visit.id),
          after: { action: dto.action === 'ASSIGN' ? 'ASSIGNED' : 'REVIEWED' },
          reason: dto.note || null,
        },
        tx,
      );
    };

    try {
      if (dto.action === 'ASSIGN') {
        await this.assignments.assign(
          {
            doctorIds: [visit.doctorId!],
            mrId: visit.mrId,
            actor,
            confirmMove: dto.confirmMove,
            note: dto.note,
            source: 'VISIT_REVIEW',
            visitId: visit.id,
          },
          mark,
        );
      } else {
        await this.prisma.$transaction(mark, TX_OPTIONS);
      }
    } catch (error) {
      throw this.friendlyWriteError(error);
    }
    return this.get(visit.id, actor);
  }

  /** Completed visits are never deleted — not even by an admin. */
  public async remove(id: number, actor: AuthUser): Promise<never> {
    await this.requireVisible(id, actor);
    throw new ConflictError('Completed visits cannot be deleted — use Correct visit');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async resolveTarget(actor: AuthUser, requestedId?: number) {
    let id: number;
    if (actor.role === AppRoles.MR) {
      if (requestedId && requestedId !== actor.id) throw new ForbiddenError('You can only log your own visits');
      id = actor.id;
    } else if (actor.role === AppRoles.MANAGER) {
      id = requestedId ?? actor.id;
      if (id !== actor.id) {
        const team = (await this.scope.visibleUserIds(actor)) ?? [];
        if (!team.includes(id)) throw new ForbiddenError('That MR is outside your team');
      }
    } else {
      if (!requestedId) throw new BadRequestError('Choose the MR who made the visit');
      id = requestedId;
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true, role: true, status: true, managerId: true },
    });
    if (!user || (user.role !== AppRoles.MR && user.role !== AppRoles.MANAGER)) {
      throw new NotFoundError('Medical Representative not found');
    }
    if (user.status !== UserStatuses.ACTIVE) {
      throw new BadRequestError(`${user.fullName} is deactivated — no new visits`);
    }
    return user;
  }

  private async assertDateAllowed(actor: AuthUser, visitDate: Date): Promise<void> {
    const today = todayDateOnly();
    if (visitDate.getTime() > today.getTime()) throw new BadRequestError('A visit cannot be in the future');
    const back = actor.role === AppRoles.MR ? await this.backDateDays() : MANAGER_BACK_DAYS;
    if (visitDate.getTime() < addDays(today, -back).getTime()) {
      throw new BadRequestError(
        actor.role === AppRoles.MR
          ? `Visits older than ${back} days are logged by your manager`
          : `Visits older than ${back} days cannot be logged`,
      );
    }
  }

  private async backDateDays(): Promise<number> {
    const setting = await this.settings.findByKey('visit.backDateDays');
    const value = Number(setting?.value);
    return Number.isInteger(value) && value >= 0 && value <= MANAGER_BACK_DAYS ? value : DEFAULT_MR_BACK_DAYS;
  }

  private async requireActiveDoctor(doctorId: number) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, deletedAt: null },
      select: { id: true, fullName: true, status: true },
    });
    if (!doctor) throw new NotFoundError('Doctor not found');
    if (doctor.status !== 'ACTIVE') throw new BadRequestError(`${doctor.fullName} is inactive — no new visits`);
    return doctor;
  }

  /** Serialises writers of the same MR + doctor + day until the transaction ends. */
  private async lockSlot(tx: Tx, mrId: number, doctorId: number, day: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VISIT_LOCK_CLASS}::int, hashtext(${`${mrId}:${doctorId}:${day}`}))`;
  }

  private replay(
    earlier: { id: number; mrId: number; offList: boolean; appointmentId: number | null },
    targetId: number,
  ) {
    if (earlier.mrId !== targetId) throw new ConflictError('This form was already saved for someone else');
    return { visitId: earlier.id, replayed: true, offList: earlier.offList, appointmentId: earlier.appointmentId };
  }

  /**
   * Turns sample lines into batch allocations from the MR's bag: pinned batches as
   * asked, the rest earliest-expiry first (expired batches never), split across
   * batches when one is not enough. Quantities of the same medicine are added up.
   */
  private async allocateSamples(mrId: number, samples: VisitSampleInput[], asOf: Date): Promise<SampleAllocation[]> {
    if (samples.length === 0) return [];
    const medicineIds = [...new Set(samples.map((s) => s.medicineId))];
    const [balances, medicines] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { holderType: 'USER', holderId: mrId, medicineId: { in: medicineIds }, qty: { gt: 0 } },
        include: { batch: { select: { id: true, batchNo: true, expiryDate: true, deletedAt: true } } },
      }),
      this.prisma.medicine.findMany({ where: { id: { in: medicineIds } }, select: { id: true, name: true } }),
    ]);
    const name = new Map(medicines.map((m) => [m.id, m.name]));
    for (const id of medicineIds) if (!name.has(id)) throw new NotFoundError(`Medicine ${id} not found`);
    const usable = balances
      // A batch past its expiry today is never handed out, whatever the visit date.
      .filter((b) => !b.batch.deletedAt && (!b.batch.expiryDate || b.batch.expiryDate.getTime() >= Math.max(asOf.getTime(), todayDateOnly().getTime())))
      .sort((a, b) => {
        const ea = a.batch.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const eb = b.batch.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return ea - eb || a.batchId - b.batchId;
      });
    const left = new Map(usable.map((b) => [b.batchId + ':' + b.medicineId, b.qty]));
    const out: SampleAllocation[] = [];

    for (const s of samples.filter((x) => x.batchId || x.batchNumber)) {
      const b = usable.find(
        (u) => u.medicineId === s.medicineId && (s.batchId ? u.batchId === s.batchId : u.batch.batchNo === s.batchNumber),
      );
      const label = name.get(s.medicineId)!;
      if (!b) throw new ConflictError(`${label}: that batch is not in the stock bag (or has expired)`);
      const key = b.batchId + ':' + b.medicineId;
      const available = left.get(key) ?? 0;
      if (available < s.quantity) {
        throw new ConflictError(`Not enough stock of ${label} (batch ${b.batch.batchNo}) — ${available} in the bag, ${s.quantity} needed`);
      }
      left.set(key, available - s.quantity);
      out.push({ medicineId: s.medicineId, medicineName: label, batchId: b.batchId, batchNo: b.batch.batchNo, qty: s.quantity, remarks: s.remarks });
    }

    const auto = new Map<number, { qty: number; remarks?: string }>();
    for (const s of samples.filter((x) => !x.batchId && !x.batchNumber)) {
      const row = auto.get(s.medicineId) ?? { qty: 0, remarks: s.remarks };
      row.qty += s.quantity;
      auto.set(s.medicineId, row);
    }
    for (const [medicineId, { qty, remarks }] of auto) {
      const label = name.get(medicineId)!;
      const pool = usable.filter((u) => u.medicineId === medicineId);
      const available = pool.reduce((sum, u) => sum + (left.get(u.batchId + ':' + medicineId) ?? 0), 0);
      if (available < qty) {
        throw new ConflictError(`Not enough stock of ${label} in the bag — ${available} available, ${qty} needed`);
      }
      let need = qty;
      for (const u of pool) {
        if (need === 0) break;
        const key = u.batchId + ':' + medicineId;
        const take = Math.min(need, left.get(key) ?? 0);
        if (take === 0) continue;
        left.set(key, (left.get(key) ?? 0) - take);
        need -= take;
        out.push({ medicineId, medicineName: label, batchId: u.batchId, batchNo: u.batch.batchNo, qty: take, remarks });
      }
    }
    return out;
  }

  private productRows(input: Pick<RecordVisitInput, 'products' | 'medicineIds'>) {
    const rows = input.products && input.products.length > 0
      ? input.products
      : (input.medicineIds ?? []).map((medicineId) => ({ medicineId }) as VisitProductInput);
    const byMedicine = new Map<number, { medicineId: number; interestLevel: string | null; prescriptionExpected: boolean; notes: string | null }>();
    for (const p of rows) {
      byMedicine.set(p.medicineId, {
        medicineId: p.medicineId,
        interestLevel: p.interestLevel ?? null,
        prescriptionExpected: p.prescriptionExpected ?? false,
        notes: p.notes ?? null,
      });
    }
    return [...byMedicine.values()];
  }

  private productKey(products: Array<{ medicineId: number; interestLevel?: string | null; prescriptionExpected?: boolean; notes?: string | null }>) {
    return [...products]
      .map((p) => ({ medicineId: p.medicineId, interestLevel: p.interestLevel ?? null, prescriptionExpected: p.prescriptionExpected ?? false, notes: p.notes ?? null }))
      .sort((a, b) => a.medicineId - b.medicineId);
  }

  /** The editable fields of a visit, as plain values (for diffing a correction). */
  private correctable(visit: VisitRow) {
    return {
      visitDate: formatDateOnly(visit.visitDate),
      doctorId: visit.doctorId,
      visitTime: formatTime(visit.visitTime),
      checkInTime: formatTime(visit.checkInTime),
      checkOutTime: formatTime(visit.checkOutTime),
      purpose: visit.purpose,
      discussionNotes: visit.discussionNotes,
      doctorFeedback: visit.doctorFeedback,
      visitOutcome: visit.visitOutcome,
      nextFollowUp: visit.nextFollowUp ? formatDateOnly(visit.nextFollowUp) : null,
      remarks: visit.remarks,
      products: this.productKey(visit.products),
    };
  }

  private async listWhere(query: ListVisitsQueryDto, actor: AuthUser): Promise<Prisma.VisitWhereInput> {
    const visible = await this.scope.visibleUserIds(actor, { includeInactive: true });
    if (query.mrId && visible && !visible.includes(query.mrId)) {
      throw new ForbiddenError('That MR is outside your team');
    }
    const search = query.search;
    return {
      deletedAt: null,
      ...(query.mrId ? { mrId: query.mrId } : visible ? { mrId: { in: visible } } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.from || query.to
        ? {
            visitDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { doctor: { fullName: { contains: search, mode: 'insensitive' } } },
              { doctor: { area: { contains: search, mode: 'insensitive' } } },
              { mr: { fullName: { contains: search, mode: 'insensitive' } } },
              { doctor: { mslNo: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  /** A visit the actor may see (Manager: whole team, deactivated MRs included). Deleted → 404. */
  private async requireVisible(id: number, actor: AuthUser): Promise<VisitRow> {
    const visit = await this.prisma.visit.findFirst({ where: { id, deletedAt: null }, include: visitInclude });
    if (!visit) throw new NotFoundError('Visit not found');
    const visible = await this.scope.visibleUserIds(actor, { includeInactive: true });
    if (visible && !visible.includes(visit.mrId)) throw new ForbiddenError('That visit is outside your team');
    return visit;
  }

  /**
   * Net samples per visit and batch: given − returned − written off. Corrections are
   * separate ledger rows, so the original SAMPLE_GIVEN rows are never touched.
   */
  private async samplesFor(visitIds: number[]) {
    const out = new Map<number, Array<{ medicineId: number; medicineName: string; batchId: number; batchNumber: string; expiryDate: string | null; given: number; returned: number; writtenOff: number; quantity: number; remarks: string | null }>>();
    if (visitIds.length === 0) return out;
    const txns = await this.prisma.stockTxn.findMany({
      where: {
        refType: 'VISIT',
        refId: { in: visitIds },
        txnType: { in: [StockTxnTypes.SAMPLE_GIVEN, StockTxnTypes.RETURN, StockTxnTypes.LOST] },
      },
      include: {
        medicine: { select: { id: true, name: true } },
        batch: { select: { batchNo: true, expiryDate: true } },
      },
      orderBy: { id: 'asc' },
    });
    for (const t of txns) {
      if (t.refId == null) continue;
      const list = out.get(t.refId) ?? [];
      let line = list.find((l) => l.medicineId === t.medicineId && l.batchId === t.batchId);
      if (!line) {
        line = {
          medicineId: t.medicineId,
          medicineName: t.medicine.name,
          batchId: t.batchId,
          batchNumber: t.batch.batchNo,
          expiryDate: t.batch.expiryDate ? formatDateOnly(t.batch.expiryDate) : null,
          given: 0,
          returned: 0,
          writtenOff: 0,
          quantity: 0,
          remarks: null,
        };
        list.push(line);
      }
      if (t.txnType === StockTxnTypes.SAMPLE_GIVEN) {
        line.given += t.qty;
        line.remarks ??= t.note;
      } else if (t.txnType === StockTxnTypes.RETURN) line.returned += t.qty;
      else line.writtenOff += t.qty;
      line.quantity = line.given - line.returned - line.writtenOff;
      out.set(t.refId, list);
    }
    return out;
  }

  private async flagsFor(actor: AuthUser) {
    return { role: actor.role, actorId: actor.id, backDays: actor.role === AppRoles.MR ? await this.backDateDays() : MANAGER_BACK_DAYS };
  }

  private async medicineName(id: number) {
    return (await this.prisma.medicine.findUnique({ where: { id }, select: { name: true } }))?.name ?? `Medicine ${id}`;
  }

  /** Stock races and unique clashes become a clear 409 instead of a 500. */
  private friendlyWriteError(error: unknown): unknown {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      return new ConflictError('The bag changed while saving — not enough stock now. Refresh and try again.');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictError('This visit was already saved');
    }
    return error;
  }

  private toPublic(
    visit: VisitRow,
    samples: Array<{ medicineId: number; medicineName: string; batchId: number; batchNumber: string; expiryDate: string | null; given: number; returned: number; writtenOff: number; quantity: number; remarks: string | null }>,
    flags: { role: string; actorId: number; backDays: number },
  ) {
    const windowStart = addDays(todayDateOnly(), -flags.backDays).getTime();
    const isMr = flags.role === AppRoles.MR;
    return {
      id: visit.id,
      appointmentId: visit.appointmentId,
      doctorId: visit.doctorId,
      mrId: visit.mrId,
      source: visit.source,
      visitDate: formatDateOnly(visit.visitDate),
      visitTime: formatTime(visit.visitTime),
      checkInTime: formatTime(visit.checkInTime),
      checkOutTime: formatTime(visit.checkOutTime),
      meetingDurationMin: visit.meetingDurationMin,
      purpose: visit.purpose,
      discussionNotes: visit.discussionNotes,
      doctorFeedback: visit.doctorFeedback,
      visitOutcome: visit.visitOutcome,
      nextFollowUp: visit.nextFollowUp ? formatDateOnly(visit.nextFollowUp) : null,
      remarks: visit.remarks,
      location: visit.inLat != null && visit.inLng != null ? { lat: visit.inLat, lng: visit.inLng } : null,
      offList: visit.offList,
      review: visit.offListReviewedAt
        ? {
            at: visit.offListReviewedAt,
            by: visit.offListReviewedBy,
            action: visit.offListReviewAction,
            note: visit.offListReviewNote,
          }
        : null,
      lastCorrectedAt: visit.lastCorrectedAt,
      doctor: visit.doctor,
      mr: visit.mr,
      appointment: visit.appointment
        ? {
            id: visit.appointment.id,
            date: formatDateOnly(visit.appointment.date),
            time: formatTime(visit.appointment.time),
            purpose: visit.appointment.purpose,
            status: visit.appointment.status,
          }
        : null,
      products: visit.products.map((p) => ({
        id: p.medicine.id,
        name: p.medicine.name,
        interestLevel: p.interestLevel,
        prescriptionExpected: p.prescriptionExpected,
        notes: p.notes,
      })),
      distributions: samples.map((s) => ({
        medicineId: s.medicineId,
        medicineName: s.medicineName,
        batchId: s.batchId,
        batchNumber: s.batchNumber,
        expiryDate: s.expiryDate,
        quantity: s.quantity,
        given: s.given,
        returned: s.returned,
        writtenOff: s.writtenOff,
        remarks: s.remarks,
      })),
      can: {
        correct: !isMr || (visit.mrId === flags.actorId && visit.visitDate.getTime() >= windowStart),
        changeDateOrDoctor: !isMr,
        correctSamples: !isMr,
        review: !isMr && visit.offList && !visit.offListReviewedAt,
      },
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    };
  }
}
