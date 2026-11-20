import type { Prisma } from '@prisma/client';
import { AppRoles, UserStatuses } from '../constants';
import {
  mslDoctorDetailsSchema,
  mslStoreDetailsSchema,
  type CreateMslRequestDto,
  type DecideMslRequestDto,
  type ListMslRequestsQueryDto,
} from '../dto/msl.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { AuditService } from './AuditService';
import { DoctorAssignmentService } from './DoctorAssignmentService';
import { NotificationService } from './NotificationService';
import { TeamScopeService } from './TeamScopeService';

type Party = 'DOCTOR' | 'CHEMIST' | 'STOCKIST';
const NOUN: Record<Party, string> = { DOCTOR: 'doctor', CHEMIST: 'chemist', STOCKIST: 'stockist' };
const TX_OPTIONS = { timeout: 20_000, maxWait: 20_000 };

const requestInclude = {
  mr: { select: { id: true, fullName: true, managerId: true } },
  decidedBy: { select: { id: true, fullName: true } },
  doctor: { select: { id: true, fullName: true, mslNo: true, area: true } },
  store: { select: { id: true, name: true, type: true, city: true } },
} satisfies Prisma.MslRequestInclude;
type RequestRow = Prisma.MslRequestGetPayload<{ include: typeof requestInclude }>;

/**
 * MslRequestService — an MR asks to add a doctor / chemist / stockist to their MSL list
 * or take one off; their Manager (own team) or Admin decides (M2.3).
 *
 * Nothing changes until approval. Approving an ADD creates the doctor (MSL No from the
 * database) or store and puts it in the MR's list; approving a REMOVE ends the MR's
 * assignment — the master record and every visit stay. Decisions are one-shot
 * (a second decision gets 409) and audited with the assignment change in one transaction.
 */
export class MslRequestService {
  private static instance: MslRequestService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly audits = AuditService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly notifications = NotificationService.getInstance(),
    private readonly assignments = DoctorAssignmentService.getInstance(),
  ) {}

  public static getInstance(): MslRequestService {
    if (!MslRequestService.instance) {
      MslRequestService.instance = new MslRequestService();
    }
    return MslRequestService.instance;
  }

  public async create(dto: CreateMslRequestDto, actor: AuthUser) {
    if (actor.role !== AppRoles.MR) throw new ForbiddenError('MSL requests are made by MRs — Managers and Admin change lists directly');
    const party = dto.party as Party;
    let doctorId: number | null = null;
    let storeId: number | null = null;
    let details: Prisma.InputJsonValue | undefined;

    if (dto.action === 'ADD') {
      const parsed = party === 'DOCTOR' ? mslDoctorDetailsSchema.parse(dto.details) : mslStoreDetailsSchema.parse(dto.details);
      details = parsed as Prisma.InputJsonValue;
      const name = 'fullName' in parsed ? parsed.fullName : parsed.name;
      const pending = await this.prisma.mslRequest.findMany({
        where: { mrId: actor.id, party, action: 'ADD', status: 'PENDING', deletedAt: null },
        select: { details: true },
      });
      const same = pending.some((row) => {
        const d = (row.details ?? {}) as { fullName?: string; name?: string };
        return (d.fullName ?? d.name ?? '').trim().toLowerCase() === name.trim().toLowerCase();
      });
      if (same) throw new ConflictError(`You already asked to add ${name} — it is waiting for your manager`);
    } else if (party === 'DOCTOR') {
      const row = await this.prisma.doctorAssignment.findFirst({
        where: { doctorId: dto.doctorId, mrId: actor.id, isActive: true, deletedAt: null },
        select: { doctor: { select: { id: true, fullName: true } } },
      });
      if (!row) throw new BadRequestError('That doctor is not in your list');
      doctorId = row.doctor.id;
    } else {
      const row = await this.prisma.storeAssignment.findFirst({
        where: { storeId: dto.storeId, mrId: actor.id, isActive: true, deletedAt: null, store: { type: party } },
        select: { store: { select: { id: true } } },
      });
      if (!row) throw new BadRequestError(`That ${NOUN[party]} is not in your list`);
      storeId = row.store.id;
    }
    if (dto.action === 'REMOVE') {
      const open = await this.prisma.mslRequest.findFirst({
        where: { mrId: actor.id, action: 'REMOVE', status: 'PENDING', deletedAt: null, ...(doctorId ? { doctorId } : { storeId }) },
        select: { id: true },
      });
      if (open) throw new ConflictError('You already asked to take it off — it is waiting for your manager');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mslRequest.create({
        data: {
          action: dto.action,
          party,
          mrId: actor.id,
          doctorId,
          storeId,
          details,
          reason: dto.reason || null,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        include: requestInclude,
      });
      await this.audits.log(
        { userId: actor.id, action: 'MSL_REQUESTED', entity: 'MslRequest', entityId: String(row.id), after: { action: dto.action, party, doctorId, storeId, details: details ?? null }, reason: dto.reason || null },
        tx,
      );
      return row;
    }, TX_OPTIONS);

    if (created.mr.managerId) {
      await this.notifications.create({
        userId: created.mr.managerId,
        kind: 'MSL_REQUEST',
        title: `${actor.fullName} asks to ${dto.action === 'ADD' ? 'add' : 'remove'} a ${NOUN[party]}`,
        message: `${this.subject(created)} — open MSL Requests to decide.`,
        href: '/msl-requests',
        tone: 'warning',
      });
    }
    return this.toPublic(created);
  }

  public async list(query: ListMslRequestsQueryDto, actor: AuthUser) {
    let where: Prisma.MslRequestWhereInput;
    if (query.scope === 'mine') {
      where = { mrId: actor.id };
    } else {
      if (!actor.permissions.includes('msl-requests:manage')) throw new ForbiddenError('You do not decide MSL requests');
      const visible = await this.scope.visibleUserIds(actor, { includeInactive: true });
      where = visible ? { mrId: { in: visible.filter((id) => id !== actor.id) } } : {};
    }
    where = { ...where, deletedAt: null, ...(query.party ? { party: query.party } : {}) };
    const [rows, pending] = await Promise.all([
      this.prisma.mslRequest.findMany({
        where: { ...where, ...(query.status ? { status: query.status } : {}) },
        include: requestInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      }),
      this.prisma.mslRequest.count({ where: { ...where, status: 'PENDING' } }),
    ]);
    const items = await Promise.all(
      rows.map(async (row) => ({
        ...this.toPublic(row),
        ...(query.scope === 'team' && row.status === 'PENDING' && row.action === 'ADD' ? { similar: await this.similar(row) } : {}),
      })),
    );
    return { items, meta: { pending } };
  }

  public async cancel(id: number, actor: AuthUser) {
    const row = await this.requireRow(id);
    if (row.mrId !== actor.id) throw new ForbiddenError('You can only cancel your own requests');
    const { count } = await this.prisma.mslRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date(), updatedBy: actor.id },
    });
    if (count === 0) throw new ConflictError('This request was already decided');
    await this.audits.log({ userId: actor.id, action: 'MSL_CANCELLED', entity: 'MslRequest', entityId: String(id) });
    return this.toPublic(await this.requireRow(id));
  }

  public async decide(id: number, dto: DecideMslRequestDto, actor: AuthUser) {
    const row = await this.requireRow(id);
    if (actor.role === AppRoles.MANAGER) {
      const team = (await this.scope.visibleUserIds(actor, { includeInactive: true })) ?? [];
      if (!team.includes(row.mrId) || row.mrId === actor.id) throw new ForbiddenError('That MR is outside your team');
    } else if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('You do not decide MSL requests');
    }
    if (row.status !== 'PENDING') throw new ConflictError('This request was already decided');
    const party = row.party as Party;
    const approve = dto.action === 'APPROVE';
    if (approve) {
      const mr = await this.prisma.user.findFirst({ where: { id: row.mrId, deletedAt: null }, select: { status: true, fullName: true } });
      if (!mr || mr.status !== UserStatuses.ACTIVE) throw new BadRequestError(`${mr?.fullName ?? 'The MR'} is deactivated — reject the request instead`);
    }
    const brief = approve ? (await this.assignments.briefs([row.mrId])).get(row.mrId) : undefined;
    const mrAudit = brief ? { mrId: brief.id, mrName: brief.fullName, employeeCode: brief.employeeCode, team: brief.team } : { mrId: row.mrId };

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // One-shot: whoever claims the PENDING row first decides it.
      const { count } = await tx.mslRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: actor.id, decidedAt: now, decisionNote: dto.note || null, updatedBy: actor.id },
      });
      if (count === 0) throw new ConflictError('This request was already decided');
      if (!approve) return;

      const base = { userId: actor.id, reason: row.reason, metadata: { source: 'MSL_REQUEST', requestId: id } };
      if (row.action === 'ADD' && party === 'DOCTOR') {
        const d = mslDoctorDetailsSchema.parse(row.details);
        const doctor = await tx.doctor.create({ data: { ...d, createdBy: actor.id, updatedBy: actor.id }, select: { id: true, fullName: true } });
        await tx.doctorAssignment.create({ data: { doctorId: doctor.id, mrId: row.mrId, createdBy: actor.id, updatedBy: actor.id } });
        await tx.mslRequest.update({ where: { id }, data: { doctorId: doctor.id } });
        await this.audits.log({ ...base, action: 'DOCTOR_ASSIGNED', entity: 'Doctor', entityId: String(doctor.id), before: { mrId: null }, after: mrAudit, metadata: { ...base.metadata, doctor: doctor.fullName } }, tx);
      } else if (row.action === 'ADD') {
        const s = mslStoreDetailsSchema.parse(row.details);
        const store = await tx.medicalStore.create({ data: { ...s, type: party === 'STOCKIST' ? 'STOCKIST' : 'CHEMIST', createdBy: actor.id, updatedBy: actor.id }, select: { id: true, name: true } });
        await tx.storeAssignment.create({ data: { storeId: store.id, mrId: row.mrId, createdBy: actor.id, updatedBy: actor.id } });
        await tx.mslRequest.update({ where: { id }, data: { storeId: store.id } });
        await this.audits.log({ ...base, action: 'STORE_ASSIGNED', entity: 'MedicalStore', entityId: String(store.id), before: { mrId: null }, after: mrAudit, metadata: { ...base.metadata, store: store.name } }, tx);
      } else if (party === 'DOCTOR' && row.doctorId) {
        await tx.doctorAssignment.updateMany({
          where: { doctorId: row.doctorId, mrId: row.mrId, isActive: true, deletedAt: null },
          data: { isActive: false, unassignedAt: now, updatedBy: actor.id },
        });
        await this.audits.log({ ...base, action: 'DOCTOR_UNASSIGNED', entity: 'Doctor', entityId: String(row.doctorId), before: mrAudit, after: { mrId: null } }, tx);
      } else if (row.storeId) {
        await tx.storeAssignment.updateMany({
          where: { storeId: row.storeId, mrId: row.mrId, isActive: true, deletedAt: null },
          data: { isActive: false, unassignedAt: now, updatedBy: actor.id },
        });
        await this.audits.log({ ...base, action: 'STORE_UNASSIGNED', entity: 'MedicalStore', entityId: String(row.storeId), before: mrAudit, after: { mrId: null } }, tx);
      }
      await this.audits.log({ userId: actor.id, action: 'MSL_APPROVED', entity: 'MslRequest', entityId: String(id), reason: dto.note || null }, tx);
    }, TX_OPTIONS);

    if (!approve) await this.audits.log({ userId: actor.id, action: 'MSL_REJECTED', entity: 'MslRequest', entityId: String(id), reason: dto.note || null });
    const decided = await this.requireRow(id);
    await this.notifications.create({
      userId: decided.mrId,
      kind: 'MSL_DECIDED',
      title: `MSL request ${approve ? 'approved' : 'rejected'}`,
      message: `${this.subject(decided)}${dto.note ? ` — ${dto.note}` : ''}`,
      href: '/approvals?kind=msl',
      tone: approve ? 'success' : 'danger',
    });
    return this.toPublic(decided);
  }

  private async requireRow(id: number): Promise<RequestRow> {
    const row = await this.prisma.mslRequest.findFirst({ where: { id, deletedAt: null }, include: requestInclude });
    if (!row) throw new NotFoundError('MSL request not found');
    return row;
  }

  /** Doctors / stores that look like the one being added (same name or phone) — shown before approving. */
  private async similar(row: RequestRow) {
    const d = (row.details ?? {}) as { fullName?: string; name?: string; phone?: string };
    const name = (d.fullName ?? d.name ?? '').trim();
    if (row.party === 'DOCTOR') {
      const doctors = await this.prisma.doctor.findMany({
        where: { deletedAt: null, OR: [{ fullName: { equals: name, mode: 'insensitive' } }, ...(d.phone ? [{ phone: d.phone }] : [])] },
        select: { id: true, fullName: true, mslNo: true, area: true },
        take: 5,
      });
      return doctors.map((x) => ({ id: x.id, name: x.fullName, info: [x.mslNo, x.area].filter(Boolean).join(' · ') }));
    }
    const stores = await this.prisma.medicalStore.findMany({
      where: { deletedAt: null, OR: [{ name: { equals: name, mode: 'insensitive' } }, ...(d.phone ? [{ phone: d.phone }] : [])] },
      select: { id: true, name: true, city: true, type: true },
      take: 5,
    });
    return stores.map((x) => ({ id: x.id, name: x.name, info: [x.type === 'STOCKIST' ? 'Stockist' : 'Chemist', x.city].filter(Boolean).join(' · ') }));
  }

  private subject(row: RequestRow): string {
    const d = (row.details ?? {}) as { fullName?: string; name?: string };
    const who = row.doctor?.fullName ?? row.store?.name ?? d.fullName ?? d.name ?? NOUN[row.party as Party];
    return `${row.action === 'ADD' ? 'Add' : 'Remove'} ${who}`;
  }

  private toPublic(row: RequestRow) {
    return {
      id: row.id,
      action: row.action,
      party: row.party,
      status: row.status,
      mr: { id: row.mr.id, fullName: row.mr.fullName },
      doctor: row.doctor,
      store: row.store,
      details: row.details,
      reason: row.reason,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt,
      subject: this.subject(row),
    };
  }
}
