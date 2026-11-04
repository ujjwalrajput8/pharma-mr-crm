import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, MapPin, Wallet, XCircle } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge, Card, DetailRow, EmptyState } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { attendanceApi, REGULARIZATION_STATUS_TONE } from '@/services/attendance.service';
import { expensesApi, formatInr } from '@/services/expenses.service';
import { DAY_PART_LABEL, LEAVE_STATUS_TONE, leavesApi, type LeaveStatus } from '@/services/leaves.service';
import { formatDisplayDate } from '@/utils/datetime';

export type ApprovalKind = 'leave' | 'regularization' | 'flagged';
type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

/** One thing a manager can decide, whatever it is — the list and the dialog read only this. */
interface ApprovalItem {
  key: string;
  kind: ApprovalKind;
  id: number;
  person: { id: number; fullName: string };
  title: string;
  dates: string;
  reason: string;
  appliedOn: string | null;
  status: string;
  statusTone: 'warning' | 'success' | 'danger' | 'neutral';
  decidedBy: string | null;
  decisionRemark: string | null;
  canDecide: boolean;
}

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

const ACTIONS: Record<ApprovalKind, { approve: string; reject: string; approved: string; rejected: string }> = {
  leave: { approve: 'Approve', reject: 'Reject', approved: 'Leave approved — attendance marked', rejected: 'Leave rejected' },
  regularization: {
    approve: 'Approve',
    reject: 'Reject',
    approved: 'Regularization approved — register corrected',
    rejected: 'Regularization rejected',
  },
  flagged: { approve: 'Accept check-in', reject: 'Mark absent', approved: 'Check-in accepted', rejected: 'Marked absent' },
};

/**
 * Attendance & Leave → Approvals. Leave, regularization and flagged check-ins of
 * the manager's team (Admin: company), filtered on the server so nothing old is
 * ever cut off. A rejection always carries a reason.
 */
export function ApprovalsTab({ initialKind = 'leave' }: { initialKind?: ApprovalKind }) {
  const { user, can } = useAuth();
  const canLeave = can('leaves:manage');
  const canAttendance = can('attendance:manage');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [kind, setKind] = useState<ApprovalKind>(canLeave ? initialKind : 'regularization');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<{ item: ApprovalItem; approve: boolean } | null>(null);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const userId = employeeId ? Number(employeeId) : undefined;
  const monthRange = month
    ? { from: `${month}-01`, to: `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}` }
    : {};

  const overviewQuery = useQuery({ queryKey: ['attendance', 'overview'], queryFn: () => attendanceApi.overview() });
  const peopleQuery = useQuery({ queryKey: ['attendance', 'field-users'], queryFn: () => attendanceApi.fieldUsers(), enabled: canAttendance });
  const expensesQuery = useQuery({
    queryKey: ['expenses', 'pending'],
    queryFn: () => expensesApi.list({ status: 'PENDING' }),
    enabled: can('expenses:manage'),
  });

  const leavesQuery = useQuery({
    queryKey: ['leaves', 'approvals', status, userId, month],
    queryFn: () =>
      leavesApi.list({ status: status === 'ALL' ? undefined : (status as LeaveStatus), userId, limit: 200, ...monthRange }),
    enabled: canLeave && kind === 'leave',
  });
  const regsQuery = useQuery({
    queryKey: ['attendance', 'regularizations', 'approvals', status, userId, month],
    queryFn: () =>
      attendanceApi.listRegularizations({
        status: status === 'ALL' ? undefined : status,
        userId,
        month: month || undefined,
      }),
    enabled: canAttendance && kind === 'regularization',
  });
  const flaggedQuery = useQuery({
    queryKey: ['attendance', 'flagged', userId, month],
    queryFn: () => attendanceApi.list({ flagged: true, userId, limit: 200, ...monthRange }),
    enabled: canAttendance && kind === 'flagged',
  });

  const items: ApprovalItem[] = useMemo(() => {
    if (kind === 'leave') {
      return (leavesQuery.data ?? [])
        .filter((row) => row.userId !== user?.id)
        .map((row) => ({
          key: `leave-${row.id}`,
          kind,
          id: row.id,
          person: { id: row.userId, fullName: row.employee?.fullName ?? 'Employee' },
          title: `${row.leaveType?.code ?? 'Leave'} · ${row.days} day(s)${row.dayPart !== 'FULL' ? ` · ${DAY_PART_LABEL[row.dayPart]}` : ''}`,
          dates:
            row.fromDate === row.toDate
              ? formatDisplayDate(row.fromDate)
              : `${formatDisplayDate(row.fromDate)} → ${formatDisplayDate(row.toDate)}`,
          reason: row.reason,
          appliedOn: row.createdAt.slice(0, 10),
          status: row.status,
          statusTone: LEAVE_STATUS_TONE[row.status],
          decidedBy: row.approvedBy?.fullName ?? null,
          decisionRemark: row.decisionRemark,
          canDecide: row.status === 'PENDING',
        }));
    }
    if (kind === 'regularization') {
      return (regsQuery.data ?? [])
        .filter((row) => row.userId !== user?.id)
        .map((row) => ({
          key: `reg-${row.id}`,
          kind,
          id: row.id,
          person: { id: row.userId, fullName: row.employee?.fullName ?? 'Employee' },
          title: `Missed punch · in ${clock(row.requestedInAt)} · out ${clock(row.requestedOutAt)}`,
          dates: formatDisplayDate(row.attDate),
          reason: row.reason,
          appliedOn: row.createdAt.slice(0, 10),
          status: row.status,
          statusTone: REGULARIZATION_STATUS_TONE[row.status],
          decidedBy: row.decidedBy?.fullName ?? null,
          decisionRemark: row.decisionRemark,
          canDecide: row.status === 'PENDING',
        }));
    }
    return (flaggedQuery.data ?? [])
      .filter((row) => row.userId !== user?.id)
      .map((row) => ({
        key: `flag-${row.id}`,
        kind,
        id: row.id,
        person: { id: row.userId, fullName: row.mr?.fullName ?? 'Employee' },
        title: `Check-in ${clock(row.checkInAt)}${row.geofenceDistanceM ? ` · ${(row.geofenceDistanceM / 1000).toFixed(1)} km from HQ` : ''}`,
        dates: formatDisplayDate(row.attDate),
        reason: row.flagReason ?? '',
        appliedOn: null,
        status: 'PENDING',
        statusTone: 'warning' as const,
        decidedBy: null,
        decisionRemark: null,
        canDecide: true,
      }));
  }, [kind, leavesQuery.data, regsQuery.data, flaggedQuery.data, user?.id]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? items.filter((item) => [item.person.fullName, item.title, item.reason].join(' ').toLowerCase().includes(needle))
      : items;
  }, [items, search]);

  const activeQuery = kind === 'leave' ? leavesQuery : kind === 'regularization' ? regsQuery : flaggedQuery;

  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leaves'] }),
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  }

  const decideMutation = useMutation({
    mutationFn: async ({ item, approve, note }: { item: ApprovalItem; approve: boolean; note?: string }) => {
      if (item.kind === 'leave') {
        return leavesApi.decide(item.id, { status: approve ? 'APPROVED' : 'REJECTED', decisionRemark: note });
      }
      if (item.kind === 'regularization') {
        return attendanceApi.decideRegularization(item.id, { status: approve ? 'APPROVED' : 'REJECTED', remark: note });
      }
      return attendanceApi.reviewFlag(item.id, { outcome: approve ? 'ACCEPT' : 'REJECT', remarks: note });
    },
    onSuccess: async (_result, { item, approve }) => {
      toast.success(approve ? ACTIONS[item.kind].approved : ACTIONS[item.kind].rejected);
      setDecision(null);
      setRemark('');
      setError(null);
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openDecision(item: ApprovalItem, approve: boolean): void {
    setDecision({ item, approve });
    setRemark('');
    setError(null);
  }

  const pending = overviewQuery.data?.pending;
  const segments = [
    ...(canLeave ? [{ value: 'leave' as const, label: 'Leave', icon: CalendarRange, count: pending?.leaves }] : []),
    ...(canAttendance
      ? [
          { value: 'regularization' as const, label: 'Regularization', icon: CalendarClock, count: pending?.regularizations },
          { value: 'flagged' as const, label: 'Flagged check-ins', icon: AlertTriangle, count: pending?.flagged },
        ]
      : []),
  ];
  const expensePending = (expensesQuery.data ?? []).filter((row) => row.userId !== user?.id);
  const rejectNeedsReason = Boolean(decision && !decision.approve) && remark.trim().length < 3;

  return (
    <div className="space-y-4" data-testid="approvals-tab">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={segments} value={kind} onChange={(value) => { setKind(value); setSearch(''); }} />
        {expensePending.length > 0 ? (
          <Link to="/expenses" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
            <Wallet size={13} className="mr-1 inline" />
            {expensePending.length} expense claim(s) pending ·{' '}
            {formatInr(expensePending.reduce((sum, row) => sum + row.amount, 0))} → Expenses
          </Link>
        ) : null}
      </div>

      <Card>
        <div className="grid gap-2.5 border-b border-[var(--color-border)] p-3 sm:grid-cols-2 lg:grid-cols-4">
          {kind === 'flagged' ? (
            <p className="self-center text-xs text-[var(--color-muted)]">
              Showing check-ins still waiting for review. Reviewed ones move into the attendance register.
            </p>
          ) : (
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </Select>
          )}
          {canAttendance ? (
            <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Everyone</option>
              {(peopleQuery.data ?? [])
                .filter((person) => person.id !== user?.id)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
            </Select>
          ) : null}
          <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Input
            label="Search"
            placeholder="Name, type, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {activeQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <BrandLoader label="Loading requests" />
          </div>
        ) : activeQuery.isError ? (
          <EmptyState title="Could not load requests" description={getApiErrorMessage(activeQuery.error)} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={status === 'PENDING' || kind === 'flagged' ? 'Nothing waiting for you' : 'No requests found'}
            description={
              status === 'PENDING' || kind === 'flagged'
                ? 'Your team has nothing pending here.'
                : 'Try another status, employee or month.'
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]" data-testid="approvals-list">
            {visible.map((item) => (
              <li
                key={item.key}
                data-testid="approval-row"
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={item.person.fullName} userId={item.person.id} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.person.fullName}</p>
                      <Badge tone={item.statusTone}>{item.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                      {item.dates} · <span className="text-[var(--color-muted)]">{item.title}</span>
                    </p>
                    {item.reason ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {item.kind === 'flagged' ? <MapPin size={11} className="mr-1 inline" /> : null}
                        {item.reason}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      {item.appliedOn ? `Applied ${formatDisplayDate(item.appliedOn)}` : null}
                      {item.decidedBy ? ` · ${item.status === 'APPROVED' ? 'Approved' : 'Decided'} by ${item.decidedBy}` : null}
                      {item.decisionRemark ? ` · “${item.decisionRemark}”` : null}
                    </p>
                  </div>
                </div>
                {item.canDecide ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => openDecision(item, true)}>
                      <CheckCircle2 size={14} />
                      {ACTIONS[item.kind].approve}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => openDecision(item, false)}>
                      <XCircle size={14} />
                      {ACTIONS[item.kind].reject}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision ? `${decision.approve ? ACTIONS[decision.item.kind].approve : ACTIONS[decision.item.kind].reject}?` : ''}
        description={
          decision?.approve
            ? decision.item.kind === 'leave'
              ? 'Attendance for those working days is marked as Leave automatically.'
              : 'The attendance register is updated straight away.'
            : 'The employee sees your reason with the decision.'
        }
        icon={decision?.approve ? CheckCircle2 : XCircle}
        error={error}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision?.approve ? 'primary' : 'destructive'}
              loading={decideMutation.isPending}
              disabled={rejectNeedsReason}
              onClick={() =>
                decision &&
                decideMutation.mutate({ item: decision.item, approve: decision.approve, note: remark.trim() || undefined })
              }
            >
              {decision ? (decision.approve ? ACTIONS[decision.item.kind].approve : ACTIONS[decision.item.kind].reject) : ''}
            </Button>
          </>
        }
      >
        {decision ? (
          <dl>
            <DetailRow label="Employee" value={decision.item.person.fullName} />
            <DetailRow label="Request" value={decision.item.title} />
            <DetailRow label="Date(s)" value={decision.item.dates} />
            <DetailRow label={decision.item.kind === 'flagged' ? 'Flag' : 'Reason'} value={decision.item.reason} />
            {decision.item.appliedOn ? <DetailRow label="Applied on" value={formatDisplayDate(decision.item.appliedOn)} /> : null}
          </dl>
        ) : null}
        {decision && !decision.approve ? (
          <Textarea
            label="Reason for rejection"
            required
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="e.g. Month-end closing — please take it next week."
            hint="Required — the employee sees this."
          />
        ) : (
          <Textarea label="Remark" optional value={remark} onChange={(e) => setRemark(e.target.value)} />
        )}
      </Modal>
    </div>
  );
}
