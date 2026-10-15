import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Inbox,
  MapPin,
  Paperclip,
  ShieldCheck,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  PageHeader,
  StatTile,
} from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { DAY_PART_LABEL, leavesApi, type LeaveRequest } from '@/services/leaves.service';
import {
  attendanceApi,
  type Attendance,
  type Regularization,
} from '@/services/attendance.service';
import {
  EXPENSE_CATEGORY_LABEL,
  expensesApi,
  formatInr,
  type ExpenseClaim,
} from '@/services/expenses.service';
import { openStoredFile } from '@/services/files.service';
import { formatDisplayDate } from '@/utils/datetime';

function clockFromIso(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function ApprovalsPage() {
  const { user, can } = useAuth();
  const canManageLeave = can('leaves:manage');
  const canManageAttendance = can('attendance:manage');
  const canManageExpenses = can('expenses:manage');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [decision, setDecision] = useState<{
    request: LeaveRequest;
    status: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [remark, setRemark] = useState('');
  const [flagTarget, setFlagTarget] = useState<{
    row: Attendance;
    outcome: 'ACCEPT' | 'REJECT';
  } | null>(null);
  const [flagRemark, setFlagRemark] = useState('');
  const [regDecision, setRegDecision] = useState<{
    row: Regularization;
    status: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [regRemark, setRegRemark] = useState('');
  const [expenseDecision, setExpenseDecision] = useState<{
    row: ExpenseClaim;
    status: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [expenseRemark, setExpenseRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const leavesQuery = useQuery({
    queryKey: ['leaves', 'team'],
    queryFn: () => leavesApi.list(),
    enabled: canManageLeave,
  });
  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'list', 'approvals'],
    queryFn: () => attendanceApi.list(),
    enabled: canManageAttendance,
  });
  const regularizationsQuery = useQuery({
    queryKey: ['attendance', 'regularizations', 'pending'],
    queryFn: () => attendanceApi.listRegularizations({ status: 'PENDING' }),
    enabled: canManageAttendance,
  });
  const expensesQuery = useQuery({
    queryKey: ['expenses', 'pending'],
    queryFn: () => expensesApi.list({ status: 'PENDING' }),
    enabled: canManageExpenses,
  });

  const pendingLeaves = useMemo(
    () =>
      (leavesQuery.data ?? []).filter(
        (row) => row.status === 'PENDING' && row.userId !== user?.id,
      ),
    [leavesQuery.data, user?.id],
  );

  /** Check-ins the server flagged (mock GPS, poor accuracy, clock skew). */
  const flaggedAttendance = useMemo(
    () => (attendanceQuery.data ?? []).filter((row) => row.flagReason).slice(0, 20),
    [attendanceQuery.data],
  );

  const pendingRegularizations = useMemo(
    () => (regularizationsQuery.data ?? []).filter((row) => row.userId !== user?.id),
    [regularizationsQuery.data, user?.id],
  );
  const pendingExpenses = useMemo(
    () => (expensesQuery.data ?? []).filter((row) => row.userId !== user?.id),
    [expensesQuery.data, user?.id],
  );

  const decideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      leavesApi.decide(input.id, { status: input.status, decisionRemark: input.remark }),
    onSuccess: async (row) => {
      setDecision(null);
      setRemark('');
      setError(null);
      toast.success(
        row.status === 'APPROVED' ? 'Leave approved — attendance marked' : 'Leave rejected',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leaves'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  /**
   * Clears a flag once a manager has looked at it. Without this the same
   * check-in stays in the inbox and the bell for two weeks.
   */
  const reviewFlagMutation = useMutation({
    mutationFn: (input: { id: number; outcome: 'ACCEPT' | 'REJECT'; remarks?: string }) =>
      attendanceApi.reviewFlag(input.id, { outcome: input.outcome, remarks: input.remarks }),
    onSuccess: async (_row, input) => {
      setFlagTarget(null);
      setFlagRemark('');
      setError(null);
      toast.success(
        input.outcome === 'ACCEPT' ? 'Check-in accepted' : 'Marked absent',
        'Removed from your inbox.',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const regDecideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      attendanceApi.decideRegularization(input.id, {
        status: input.status,
        remark: input.remark,
      }),
    onSuccess: async (row) => {
      setRegDecision(null);
      setRegRemark('');
      setError(null);
      toast.success(
        row.status === 'APPROVED'
          ? 'Regularization approved — register corrected'
          : 'Regularization rejected',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const expenseDecideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      expensesApi.decide(input.id, { status: input.status, remark: input.remark }),
    onSuccess: async (row) => {
      setExpenseDecision(null);
      setExpenseRemark('');
      setError(null);
      toast.success(
        row.status === 'APPROVED' ? 'Expense approved' : 'Expense rejected',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const totalPending =
    pendingLeaves.length +
    flaggedAttendance.length +
    pendingRegularizations.length +
    pendingExpenses.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        description="Leave requests from your team and check-ins the system flagged for review."
      />

      {error && !decision ? <Alert message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Awaiting you"
          value={totalPending}
          hint="Everything pending below"
          icon={Inbox}
          tone={totalPending > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Leave requests"
          value={pendingLeaves.length}
          hint={`${pendingLeaves.reduce((sum, row) => sum + row.days, 0)} day(s) requested`}
          icon={CalendarRange}
        />
        <StatTile
          label="Flagged check-ins"
          value={flaggedAttendance.length}
          hint="GPS / device-clock warnings"
          icon={AlertTriangle}
          tone={flaggedAttendance.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Regularizations"
          value={pendingRegularizations.length}
          hint="Missed punch fixes"
          icon={CalendarClock}
          tone={pendingRegularizations.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Expense claims"
          value={pendingExpenses.length}
          hint={formatInr(pendingExpenses.reduce((sum, row) => sum + row.amount, 0))}
          icon={Wallet}
          tone={pendingExpenses.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* ── Leave requests ───────────────────────────────────────────────── */}
      {canManageLeave ? (
        <Card>
          <CardHeader
            title="Leave requests"
            description="Approving writes the attendance register for those days."
            actions={
              <Link to="/leave">
                <Button size="sm" variant="ghost">
                  All leave
                  <ChevronRight size={13} />
                </Button>
              </Link>
            }
          />
          {leavesQuery.isLoading ? (
            <div className="px-4 py-10 text-center text-xs text-[var(--color-muted)]">
              Loading requests…
            </div>
          ) : pendingLeaves.length === 0 ? (
            <EmptyState
              title="No leave pending"
              description="Your team has nothing waiting for approval."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {pendingLeaves.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-bg)]/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={row.employee?.fullName ?? '?'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{row.employee?.fullName}</p>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{
                            background: `color-mix(in srgb, ${row.leaveType?.colorHex ?? '#64748b'} 14%, transparent)`,
                            color: row.leaveType?.colorHex ?? 'var(--color-muted)',
                          }}
                        >
                          {row.leaveType?.code}
                        </span>
                        <Badge tone="warning">{row.days} day(s)</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                        {formatDisplayDate(row.fromDate)}
                        {row.fromDate !== row.toDate
                          ? ` → ${formatDisplayDate(row.toDate)}`
                          : row.dayPart !== 'FULL'
                            ? ` · ${DAY_PART_LABEL[row.dayPart]}`
                            : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {row.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDecision({ request: row, status: 'APPROVED' });
                        setRemark('');
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setDecision({ request: row, status: 'REJECTED' });
                        setRemark('');
                      }}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ── Flagged check-ins ────────────────────────────────────────────── */}
      {canManageAttendance ? (
        <Card>
          <CardHeader
            title="Flagged check-ins"
            description="Low GPS confidence, mock location or a device clock that disagrees with the server."
            actions={
              <Link to="/attendance">
                <Button size="sm" variant="ghost">
                  Attendance
                  <ChevronRight size={13} />
                </Button>
              </Link>
            }
          />
          {flaggedAttendance.length === 0 ? (
            <EmptyState
              title="Nothing flagged"
              description="All recent check-ins passed the location and clock checks."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {flaggedAttendance.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={row.mr?.fullName ?? '?'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{row.mr?.fullName ?? '—'}</p>
                        <Badge tone="warning">{formatDisplayDate(row.workDate)}</Badge>
                        {row.isMockLocation ? <Badge tone="danger">Mock GPS</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-warning)]">
                        {row.flagReason}
                      </p>
                      {row.latitude && row.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          <MapPin size={11} />
                          {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                          {row.accuracyM ? ` (±${Math.round(row.accuracyM)}m)` : ''}
                        </a>
                      ) : (
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                          No coordinates captured
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setFlagTarget({ row, outcome: 'ACCEPT' });
                        setFlagRemark('');
                      }}
                    >
                      <ShieldCheck size={14} />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setFlagTarget({ row, outcome: 'REJECT' });
                        setFlagRemark('');
                      }}
                    >
                      <UserX size={14} />
                      Mark absent
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ── Regularizations ──────────────────────────────────────────────── */}
      {canManageAttendance ? (
        <Card>
          <CardHeader
            title="Regularizations"
            description="Missed check-in / check-out fixes — approving corrects the attendance register."
            actions={
              <Link to="/attendance">
                <Button size="sm" variant="ghost">
                  Attendance
                  <ChevronRight size={13} />
                </Button>
              </Link>
            }
          />
          {pendingRegularizations.length === 0 ? (
            <EmptyState
              title="No regularizations pending"
              description="Missed-punch requests from your team appear here."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {pendingRegularizations.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={row.employee?.fullName ?? '?'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{row.employee?.fullName ?? '—'}</p>
                        <Badge tone="warning">{formatDisplayDate(row.attDate)}</Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--color-muted)]">
                        In {clockFromIso(row.requestedInAt)} · Out{' '}
                        {clockFromIso(row.requestedOutAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {row.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setRegDecision({ row, status: 'APPROVED' });
                        setRegRemark('');
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setRegDecision({ row, status: 'REJECTED' });
                        setRegRemark('');
                      }}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ── Expense claims ───────────────────────────────────────────────── */}
      {canManageExpenses ? (
        <Card>
          <CardHeader
            title="Expense claims"
            description="TA/DA waiting for your approval. Payout is settled from the Expenses page."
            actions={
              <Link to="/expenses">
                <Button size="sm" variant="ghost">
                  All expenses
                  <ChevronRight size={13} />
                </Button>
              </Link>
            }
          />
          {pendingExpenses.length === 0 ? (
            <EmptyState
              title="No expense claims pending"
              description="Team TA/DA claims land here for approval."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {pendingExpenses.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={row.employee?.fullName ?? '?'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{row.employee?.fullName ?? '—'}</p>
                        <Badge tone="warning">{formatInr(row.amount)}</Badge>
                        <Badge tone="neutral">{EXPENSE_CATEGORY_LABEL[row.category]}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                        {formatDisplayDate(row.expenseDate)}
                        {row.distanceKm ? ` · ${row.distanceKm} km` : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {row.description}
                      </p>
                      {row.receiptFileKey ? (
                        <button
                          type="button"
                          onClick={() => void openStoredFile(row.receiptFileKey!)}
                          className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)] hover:opacity-80"
                        >
                          <Paperclip size={10} />
                          Receipt
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setExpenseDecision({ row, status: 'APPROVED' });
                        setExpenseRemark('');
                      }}
                    >
                      <BadgeCheck size={14} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setExpenseDecision({ row, status: 'REJECTED' });
                        setExpenseRemark('');
                      }}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* ── Decide regularization ────────────────────────────────────────── */}
      <Modal
        open={Boolean(regDecision)}
        onClose={() => {
          setRegDecision(null);
          setRegRemark('');
        }}
        title={
          regDecision?.status === 'APPROVED' ? 'Approve regularization' : 'Reject regularization'
        }
        description={
          regDecision?.status === 'APPROVED'
            ? 'The attendance register for that day is corrected with the requested times.'
            : 'The register stays unchanged; the employee sees your remark.'
        }
        icon={regDecision?.status === 'APPROVED' ? CheckCircle2 : XCircle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setRegDecision(null);
                setRegRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={regDecision?.status === 'APPROVED' ? 'primary' : 'destructive'}
              loading={regDecideMutation.isPending}
              onClick={() =>
                regDecision &&
                regDecideMutation.mutate({
                  id: regDecision.row.id,
                  status: regDecision.status,
                  remark: regRemark.trim() || undefined,
                })
              }
            >
              {regDecision?.status === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        {regDecision ? (
          <dl className="mb-3">
            <DetailRow label="Employee" value={regDecision.row.employee?.fullName} />
            <DetailRow label="Date" value={formatDisplayDate(regDecision.row.attDate)} />
            <DetailRow label="Requested in" value={clockFromIso(regDecision.row.requestedInAt)} mono />
            <DetailRow
              label="Requested out"
              value={clockFromIso(regDecision.row.requestedOutAt)}
              mono
            />
            <DetailRow label="Reason" value={regDecision.row.reason} />
          </dl>
        ) : null}
        <Textarea
          label="Remark"
          optional
          value={regRemark}
          onChange={(e) => setRegRemark(e.target.value)}
          placeholder="Confirmed — he was at the CME till late."
        />
      </Modal>

      {/* ── Decide expense ───────────────────────────────────────────────── */}
      <Modal
        open={Boolean(expenseDecision)}
        onClose={() => {
          setExpenseDecision(null);
          setExpenseRemark('');
        }}
        title={expenseDecision?.status === 'APPROVED' ? 'Approve expense' : 'Reject expense'}
        description={
          expenseDecision?.status === 'APPROVED'
            ? 'An administrator settles the payout after approval.'
            : 'The employee sees your remark on the claim.'
        }
        icon={expenseDecision?.status === 'APPROVED' ? BadgeCheck : XCircle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setExpenseDecision(null);
                setExpenseRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={expenseDecision?.status === 'APPROVED' ? 'primary' : 'destructive'}
              loading={expenseDecideMutation.isPending}
              onClick={() =>
                expenseDecision &&
                expenseDecideMutation.mutate({
                  id: expenseDecision.row.id,
                  status: expenseDecision.status,
                  remark: expenseRemark.trim() || undefined,
                })
              }
            >
              {expenseDecision?.status === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        {expenseDecision ? (
          <dl className="mb-3">
            <DetailRow label="Employee" value={expenseDecision.row.employee?.fullName} />
            <DetailRow label="Date" value={formatDisplayDate(expenseDecision.row.expenseDate)} />
            <DetailRow
              label="Category"
              value={EXPENSE_CATEGORY_LABEL[expenseDecision.row.category]}
            />
            <DetailRow label="Amount" value={formatInr(expenseDecision.row.amount)} />
            <DetailRow
              label="Distance"
              value={expenseDecision.row.distanceKm ? `${expenseDecision.row.distanceKm} km` : null}
            />
            <DetailRow label="Description" value={expenseDecision.row.description} />
          </dl>
        ) : null}
        <Textarea
          label="Remark"
          optional
          value={expenseRemark}
          onChange={(e) => setExpenseRemark(e.target.value)}
          placeholder="Approved as per the TA policy slab."
        />
      </Modal>

      <Modal
        open={Boolean(flagTarget)}
        onClose={() => {
          setFlagTarget(null);
          setFlagRemark('');
        }}
        title={flagTarget?.outcome === 'ACCEPT' ? 'Accept this check-in' : 'Mark the day absent'}
        description={
          flagTarget?.outcome === 'ACCEPT'
            ? 'The day stays as recorded and the flag is cleared from your inbox. The original flag text is kept in the remarks for history.'
            : 'The check-in is discarded and the day becomes Absent. The flag is cleared either way.'
        }
        icon={flagTarget?.outcome === 'ACCEPT' ? ShieldCheck : UserX}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFlagTarget(null);
                setFlagRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={flagTarget?.outcome === 'ACCEPT' ? 'primary' : 'destructive'}
              loading={reviewFlagMutation.isPending}
              onClick={() =>
                flagTarget &&
                reviewFlagMutation.mutate({
                  id: flagTarget.row.id,
                  outcome: flagTarget.outcome,
                  remarks: flagRemark.trim() || undefined,
                })
              }
            >
              {flagTarget?.outcome === 'ACCEPT' ? 'Accept check-in' : 'Mark absent'}
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        {flagTarget ? (
          <dl className="mb-3">
            <DetailRow label="Employee" value={flagTarget.row.mr?.fullName} />
            <DetailRow label="Date" value={formatDisplayDate(flagTarget.row.workDate)} />
            <DetailRow label="Flag" value={flagTarget.row.flagReason} />
            <DetailRow
              label="GPS accuracy"
              value={flagTarget.row.accuracyM ? `±${Math.round(flagTarget.row.accuracyM)} m` : null}
            />
            <DetailRow
              label="Mock location"
              value={flagTarget.row.isMockLocation ? 'Yes — device reported a fake fix' : 'No'}
            />
          </dl>
        ) : null}
        <Textarea
          label="Note"
          optional
          value={flagRemark}
          onChange={(e) => setFlagRemark(e.target.value)}
          placeholder="Spoke to Rahul — he was inside the hospital basement, weak signal."
        />
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setRemark('');
        }}
        title={decision?.status === 'APPROVED' ? 'Approve leave' : 'Reject leave'}
        description={
          decision?.status === 'APPROVED'
            ? 'Working days in the range are marked as Leave; Sundays and holidays are skipped.'
            : 'Your remark is shown to the employee.'
        }
        icon={decision?.status === 'APPROVED' ? CheckCircle2 : XCircle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDecision(null);
                setRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={decision?.status === 'APPROVED' ? 'primary' : 'destructive'}
              loading={decideMutation.isPending}
              onClick={() =>
                decision &&
                decideMutation.mutate({
                  id: decision.request.id,
                  status: decision.status,
                  remark: remark.trim() || undefined,
                })
              }
            >
              {decision?.status === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        {decision ? (
          <dl className="mb-3">
            <DetailRow label="Employee" value={decision.request.employee?.fullName} />
            <DetailRow
              label="Leave type"
              value={`${decision.request.leaveType?.code} — ${decision.request.leaveType?.name}`}
            />
            <DetailRow
              label="Dates"
              value={`${formatDisplayDate(decision.request.fromDate)} → ${formatDisplayDate(
                decision.request.toDate,
              )}`}
            />
            <DetailRow label="Working days" value={decision.request.days} />
            <DetailRow label="Reason" value={decision.request.reason} />
            <DetailRow label="Contact" value={decision.request.contactPhone} mono />
          </dl>
        ) : null}
        <Textarea
          label="Remark"
          optional
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Approved — hand your beat over to Amit for those days."
        />
      </Modal>
    </div>
  );
}
