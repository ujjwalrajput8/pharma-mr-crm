import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';
import { formatDateOnly } from '../utils/datetime';

export type ApprovalKind = 'tour-plan' | 'expense' | 'leave' | 'msl';
/** One scale for every request type: SUBMITTED → PENDING, PAID → APPROVED (+ "Paid" detail). */
type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'OTHER';

interface ApprovalItem {
  kind: ApprovalKind;
  id: number;
  title: string;
  detail: string;
  status: Status;
  rawStatus: string;
  submittedAt: Date | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  note: string | null;
  href: string;
}

const NORMAL: Record<string, Status> = {
  PENDING: 'PENDING',
  SUBMITTED: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'APPROVED',
  LOCKED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

/**
 * MyApprovalsService — the MR's "Approval" menu (client note): the status of what they
 * sent for approval — monthly tour plans, expenses, leave and MSL requests — in one list.
 * Read only; deciding stays where it is today (Manager screens).
 */
export class MyApprovalsService {
  private static instance: MyApprovalsService | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): MyApprovalsService {
    if (!MyApprovalsService.instance) {
      MyApprovalsService.instance = new MyApprovalsService();
    }
    return MyApprovalsService.instance;
  }

  public async mine(actor: AuthUser) {
    const [plans, expenses, leaves, msl] = await Promise.all([
      this.prisma.tourPlan.findMany({
        where: { userId: actor.id, deletedAt: null, status: { not: 'DRAFT' } },
        orderBy: { planMonth: 'desc' },
        take: 24,
        select: { id: true, planMonth: true, status: true, submittedAt: true, actedAt: true, remark: true, approvedBy: { select: { fullName: true } } },
      }),
      this.prisma.expenseClaim.findMany({
        where: { userId: actor.id, deletedAt: null },
        orderBy: { expenseDate: 'desc' },
        take: 100,
        select: { id: true, expenseDate: true, category: true, amount: true, status: true, createdAt: true, actedAt: true, decisionRemark: true, decidedBy: { select: { fullName: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: { userId: actor.id, deletedAt: null },
        orderBy: { fromDate: 'desc' },
        take: 100,
        select: { id: true, fromDate: true, toDate: true, status: true, createdAt: true, actedAt: true, decisionRemark: true, approvedBy: { select: { fullName: true } }, leaveType: { select: { name: true } } },
      }),
      this.prisma.mslRequest.findMany({
        where: { mrId: actor.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, action: true, party: true, details: true, status: true, createdAt: true, decidedAt: true, decisionNote: true, reason: true, decidedBy: { select: { fullName: true } }, doctor: { select: { fullName: true } }, store: { select: { name: true } } },
      }),
    ]);

    const items: ApprovalItem[] = [
      ...plans.map((p) => ({
        kind: 'tour-plan' as const,
        id: p.id,
        title: `Tour plan · ${p.planMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        detail: 'Monthly Tour Program',
        status: NORMAL[p.status] ?? 'OTHER',
        rawStatus: p.status,
        submittedAt: p.submittedAt,
        decidedAt: p.actedAt,
        decidedBy: p.approvedBy?.fullName ?? null,
        note: p.remark,
        href: '/tour-plan',
      })),
      ...expenses.map((e) => ({
        kind: 'expense' as const,
        id: e.id,
        title: `Expense · ₹${Number(e.amount).toLocaleString('en-IN')}`,
        detail: `${e.category.replace(/_/g, ' ').toLowerCase()} · ${formatDateOnly(e.expenseDate)}${e.status === 'PAID' ? ' · paid' : ''}`,
        status: NORMAL[e.status] ?? 'OTHER',
        rawStatus: e.status,
        submittedAt: e.createdAt,
        decidedAt: e.actedAt,
        decidedBy: e.decidedBy?.fullName ?? null,
        note: e.decisionRemark,
        href: '/expenses',
      })),
      ...leaves.map((l) => ({
        kind: 'leave' as const,
        id: l.id,
        title: `Leave · ${l.leaveType.name}`,
        detail: `${formatDateOnly(l.fromDate)} → ${formatDateOnly(l.toDate)}`,
        status: NORMAL[l.status] ?? 'OTHER',
        rawStatus: l.status,
        submittedAt: l.createdAt,
        decidedAt: l.actedAt,
        decidedBy: l.approvedBy?.fullName ?? null,
        note: l.decisionRemark,
        href: '/attendance-leave?tab=leave',
      })),
      ...msl.map((m) => {
        const d = (m.details ?? {}) as { fullName?: string; name?: string };
        const who = m.doctor?.fullName ?? m.store?.name ?? d.fullName ?? d.name ?? '';
        const party = m.party === 'DOCTOR' ? 'doctor' : m.party === 'CHEMIST' ? 'chemist' : 'stockist';
        return {
          kind: 'msl' as const,
          id: m.id,
          title: `MSL · ${m.action === 'ADD' ? 'Add' : 'Remove'} ${party}`,
          detail: who,
          status: NORMAL[m.status] ?? 'OTHER',
          rawStatus: m.status,
          submittedAt: m.createdAt,
          decidedAt: m.decidedAt,
          decidedBy: m.decidedBy?.fullName ?? null,
          note: m.decisionNote ?? m.reason,
          href: '/msl-requests',
        };
      }),
    ];
    items.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
    const pending = (kind: ApprovalKind) => items.filter((i) => i.kind === kind && i.status === 'PENDING').length;
    return {
      items,
      meta: { pending: { 'tour-plan': pending('tour-plan'), expense: pending('expense'), leave: pending('leave'), msl: pending('msl') } },
    };
  }
}
