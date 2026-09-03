import { AppRoles, AttendanceStatuses, HolderTypes, LeaveStatuses } from '../constants';
import { PrismaService } from '../prisma/PrismaService';
import { TeamScopeService } from './TeamScopeService';
import { addDays, formatDateOnly, todayDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

export type NotificationKind =
  | 'LEAVE_PENDING'
  | 'LEAVE_DECIDED'
  | 'ATTENDANCE_FLAGGED'
  | 'ATTENDANCE_MISSING'
  | 'APPOINTMENT_TODAY'
  | 'VISIT_FOLLOWUP'
  | 'STOCK_EXPIRY'
  | 'DOCTOR_OCCASION';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  /** Client-side route to open. */
  href: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** ISO timestamp used for ordering; null sorts last. */
  at: string | null;
  /** Set when the row represents a group rather than one record. */
  count?: number;
}

/**
 * NotificationService — the bell and the dashboard "needs attention" card.
 *
 * Everything here is derived live from real rows; there is no notifications
 * table yet, so nothing is stored or marked read. Each item is scoped by the
 * caller's permissions, so a Manager only ever sees their own reporting line.
 */
export class NotificationService {
  private static instance: NotificationService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async list(actor: AuthUser): Promise<{
    items: AppNotification[];
    total: number;
    counts: Record<string, number>;
  }> {
    const can = (key: string): boolean => (actor.permissions ?? []).includes(key);
    const today = todayDateOnly();

    const groups = await Promise.all([
      can('leaves:manage') ? this.pendingLeave(actor) : [],
      can('attendance:manage') ? this.flaggedAttendance(actor) : [],
      can('attendance:manage') ? this.missingAttendance(actor, today) : [],
      can('leaves:own') ? this.ownLeaveDecisions(actor) : [],
      can('appointments:own') || can('appointments:manage')
        ? this.todaysAppointments(actor, today)
        : [],
      can('visits:own') || can('visits:manage') ? this.followUpsDue(actor, today) : [],
      can('mystock:own') || can('stock:manage') ? this.expiringStock(actor, today) : [],
      can('doctors:own') || can('doctors:manage') ? this.doctorOccasions(actor, today) : [],
    ]);

    const items = groups
      .flat()
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
      .slice(0, 25);

    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    }

    return { items, total: items.length, counts };
  }

  /** Leave waiting on this approver — one row per request so it can be acted on. */
  private async pendingLeave(actor: AuthUser): Promise<AppNotification[]> {
    const userIds = await this.scope.visibleUserIds(actor);
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        deletedAt: null,
        status: LeaveStatuses.PENDING,
        userId: { not: actor.id, ...(userIds ? { in: userIds } : {}) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { fullName: true } },
        leaveType: { select: { code: true } },
      },
    });

    return rows.map((row) => ({
      id: `leave-pending-${row.id}`,
      kind: 'LEAVE_PENDING' as const,
      title: `${row.user.fullName} applied for leave`,
      message: `${row.leaveType.code} · ${Number(row.days)} day(s) from ${formatDateOnly(row.fromDate)} — needs your approval`,
      href: '/approvals',
      tone: 'warning' as const,
      at: row.createdAt.toISOString(),
    }));
  }

  /** Check-ins the server flagged (mock GPS, poor accuracy, clock skew). */
  private async flaggedAttendance(actor: AuthUser): Promise<AppNotification[]> {
    const userIds = await this.scope.visibleUserIds(actor);
    const rows = await this.prisma.attendance.findMany({
      where: {
        deletedAt: null,
        flagReason: { not: null },
        attDate: { gte: addDays(todayDateOnly(), -14) },
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      orderBy: { attDate: 'desc' },
      take: 8,
      include: { user: { select: { fullName: true } } },
    });

    return rows.map((row) => ({
      id: `attendance-flag-${row.id}`,
      kind: 'ATTENDANCE_FLAGGED' as const,
      title: `Flagged check-in — ${row.user.fullName}`,
      message: `${formatDateOnly(row.attDate)} · ${row.flagReason ?? 'Needs review'}`,
      href: '/approvals',
      tone: 'warning' as const,
      at: row.attDate.toISOString(),
    }));
  }

  /** Team members with no attendance row for today — the "who is missing" nudge. */
  private async missingAttendance(actor: AuthUser, today: Date): Promise<AppNotification[]> {
    // Weekly off — nothing to chase.
    if (today.getUTCDay() === 0) return [];

    const holiday = await this.prisma.holiday.findFirst({
      where: { deletedAt: null, status: 'ACTIVE', isOptional: false, holidayDate: today },
    });
    if (holiday) return [];

    const userIds = await this.scope.visibleUserIds(actor);
    const team = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        role: { in: [AppRoles.MR, AppRoles.MANAGER] },
        id: { not: actor.id, ...(userIds ? { in: userIds } : {}) },
      },
      select: { id: true, fullName: true },
    });
    if (team.length === 0) return [];

    const marked = await this.prisma.attendance.findMany({
      where: { attDate: today, deletedAt: null, userId: { in: team.map((t) => t.id) } },
      select: { userId: true },
    });
    const markedIds = new Set(marked.map((row) => row.userId));
    const missing = team.filter((member) => !markedIds.has(member.id));
    if (missing.length === 0) return [];

    return [
      {
        id: `attendance-missing-${formatDateOnly(today)}`,
        kind: 'ATTENDANCE_MISSING',
        title: `${missing.length} not checked in today`,
        message: missing
          .slice(0, 4)
          .map((m) => m.fullName)
          .join(', ') + (missing.length > 4 ? ` +${missing.length - 4} more` : ''),
        href: '/attendance',
        tone: 'danger',
        at: new Date().toISOString(),
        count: missing.length,
      },
    ];
  }

  /** "Your leave was approved / rejected" for the employee who applied. */
  private async ownLeaveDecisions(actor: AuthUser): Promise<AppNotification[]> {
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        deletedAt: null,
        userId: actor.id,
        status: { in: [LeaveStatuses.APPROVED, LeaveStatuses.REJECTED] },
        actedAt: { gte: addDays(new Date(), -10) },
      },
      orderBy: { actedAt: 'desc' },
      take: 5,
      include: {
        leaveType: { select: { code: true } },
        approvedBy: { select: { fullName: true } },
      },
    });

    return rows.map((row) => ({
      id: `leave-decided-${row.id}`,
      kind: 'LEAVE_DECIDED' as const,
      title: `Your ${row.leaveType.code} leave was ${row.status.toLowerCase()}`,
      message: [
        `${formatDateOnly(row.fromDate)} → ${formatDateOnly(row.toDate)}`,
        row.approvedBy ? `by ${row.approvedBy.fullName}` : null,
        row.decisionRemark,
      ]
        .filter(Boolean)
        .join(' · '),
      href: '/leave',
      tone: row.status === LeaveStatuses.APPROVED ? ('success' as const) : ('danger' as const),
      at: row.actedAt?.toISOString() ?? row.updatedAt.toISOString(),
    }));
  }

  private async todaysAppointments(actor: AuthUser, today: Date): Promise<AppNotification[]> {
    const mrFilter =
      actor.role === AppRoles.MR
        ? { mrId: actor.id }
        : await (async () => {
            const ids = await this.scope.visibleUserIds(actor);
            return ids ? { mrId: { in: ids } } : {};
          })();

    const count = await this.prisma.appointment.count({
      where: {
        deletedAt: null,
        date: today,
        status: { in: ['PENDING', 'CONFIRMED', 'REQUESTED'] },
        ...mrFilter,
      },
    });
    if (count === 0) return [];

    return [
      {
        id: `appointments-today-${formatDateOnly(today)}`,
        kind: 'APPOINTMENT_TODAY',
        title: `${count} appointment${count > 1 ? 's' : ''} today`,
        message: 'Open Appointments to complete the visit and log the DCR.',
        href: '/appointments',
        tone: 'primary',
        at: today.toISOString(),
        count,
      },
    ];
  }

  /** Visits whose next follow-up date has arrived (or slipped past). */
  private async followUpsDue(actor: AuthUser, today: Date): Promise<AppNotification[]> {
    const mrFilter =
      actor.role === AppRoles.MR
        ? { mrId: actor.id }
        : await (async () => {
            const ids = await this.scope.visibleUserIds(actor);
            return ids ? { mrId: { in: ids } } : {};
          })();

    const rows = await this.prisma.visit.findMany({
      where: {
        deletedAt: null,
        nextFollowUp: { lte: today, gte: addDays(today, -14) },
        ...mrFilter,
      },
      orderBy: { nextFollowUp: 'asc' },
      take: 6,
      include: {
        doctor: { select: { fullName: true } },
        mr: { select: { fullName: true } },
      },
    });

    return rows
      .filter((row) => row.nextFollowUp)
      .map((row) => {
        const due = formatDateOnly(row.nextFollowUp!);
        const overdue = row.nextFollowUp!.getTime() < today.getTime();
        return {
          id: `followup-${row.id}`,
          kind: 'VISIT_FOLLOWUP' as const,
          title: `Follow-up ${overdue ? 'overdue' : 'due today'} — ${row.doctor?.fullName ?? 'doctor'}`,
          message: [
            `Planned for ${due}`,
            actor.role === AppRoles.MR ? null : row.mr.fullName,
            row.visitOutcome,
          ]
            .filter(Boolean)
            .join(' · '),
          href: '/visits',
          tone: overdue ? ('warning' as const) : ('primary' as const),
          at: row.nextFollowUp!.toISOString(),
        };
      });
  }

  /**
   * Sample stock going out of date. The batch expiry column existed from day one
   * but nothing warned anybody — expired samples in an MR's bag are a real
   * compliance problem, not just wastage.
   */
  private async expiringStock(actor: AuthUser, today: Date): Promise<AppNotification[]> {
    const ownBagOnly = actor.role === AppRoles.MR;
    const cutoff = addDays(today, 90);

    const rows = await this.prisma.stockBalance.findMany({
      where: {
        qty: { gt: 0 },
        batch: { deletedAt: null, expiryDate: { not: null, lte: cutoff } },
        ...(ownBagOnly ? { holderType: HolderTypes.USER, holderId: actor.id } : {}),
      },
      include: {
        medicine: { select: { name: true } },
        batch: { select: { batchNo: true, expiryDate: true } },
      },
      orderBy: { qty: 'desc' },
      take: 200,
    });
    if (rows.length === 0) return [];

    const expired = rows.filter(
      (row) => row.batch.expiryDate && row.batch.expiryDate.getTime() < today.getTime(),
    );
    const soon = rows.filter(
      (row) => row.batch.expiryDate && row.batch.expiryDate.getTime() >= today.getTime(),
    );

    const items: AppNotification[] = [];

    if (expired.length > 0) {
      const units = expired.reduce((sum, row) => sum + row.qty, 0);
      items.push({
        id: `stock-expired-${formatDateOnly(today)}`,
        kind: 'STOCK_EXPIRY',
        title: `${units} unit(s) already expired`,
        message: `${expired.length} batch(es) past expiry — e.g. ${expired[0]!.medicine.name} (${expired[0]!.batch.batchNo}). Write them off.`,
        href: ownBagOnly ? '/my-stock' : '/stock',
        tone: 'danger',
        at: new Date().toISOString(),
        count: expired.length,
      });
    }

    if (soon.length > 0) {
      const next = soon[0]!;
      items.push({
        id: `stock-expiring-${formatDateOnly(today)}`,
        kind: 'STOCK_EXPIRY',
        title: `${soon.length} batch(es) expiring within 90 days`,
        message: `Earliest: ${next.medicine.name} (${next.batch.batchNo}) on ${formatDateOnly(next.batch.expiryDate!)}. Use or return them first.`,
        href: ownBagOnly ? '/my-stock' : '/stock',
        tone: 'warning',
        at: next.batch.expiryDate!.toISOString(),
        count: soon.length,
      });
    }

    return items;
  }

  /**
   * Doctor birthdays and anniversaries in the next 7 days.
   * The columns already existed but nothing surfaced them — this is the cheapest
   * relationship win an MR gets from the CRM.
   */
  private async doctorOccasions(actor: AuthUser, today: Date): Promise<AppNotification[]> {
    const assignedOnly = actor.role === AppRoles.MR;
    const doctors = await this.prisma.doctor.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [{ birthday: { not: null } }, { anniversary: { not: null } }],
        ...(assignedOnly
          ? { assignments: { some: { mrId: actor.id, isActive: true, deletedAt: null } } }
          : {}),
      },
      select: { id: true, fullName: true, birthday: true, anniversary: true },
      take: 500,
    });

    /** Days until the next occurrence of a month/day, ignoring the stored year. */
    const daysAway = (date: Date): number => {
      const target = new Date(
        Date.UTC(today.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
      return diff < 0 ? diff + 365 : diff;
    };

    const items: AppNotification[] = [];
    for (const doctor of doctors) {
      for (const [label, value] of [
        ['Birthday', doctor.birthday],
        ['Anniversary', doctor.anniversary],
      ] as const) {
        if (!value) continue;
        const away = daysAway(value);
        if (away > 7) continue;
        items.push({
          id: `doctor-${label.toLowerCase()}-${doctor.id}`,
          kind: 'DOCTOR_OCCASION',
          title: `${doctor.fullName} — ${label.toLowerCase()} ${away === 0 ? 'today' : `in ${away} day(s)`}`,
          message: 'A greeting call or card goes a long way. Open the doctor profile.',
          href: `/doctors/${doctor.id}`,
          tone: away === 0 ? 'success' : 'neutral',
          at: new Date(today.getTime() + away * 86_400_000).toISOString(),
        });
      }
    }

    return items.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '')).slice(0, 6);
  }
}
