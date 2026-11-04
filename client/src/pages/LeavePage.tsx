import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  Paperclip,
  Ban,
  Gift,
  ScrollText,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataTable, TableToolbar, Td } from '@/components/ui/DataTable';
import { Textarea } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal } from '@/components/ui/Modal';
import { LeaveApplyDialog } from '@/components/attendance-leave/LeaveApplyDialog';
import {
  Alert,
  Badge,
  Card,
  DetailRow,
  EmptyState,
  PageHeader,
  StatTile,
} from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import {
  DAY_PART_LABEL,
  LEAVE_STATUS_TONE,
  leavesApi,
  type LeaveCalendarEntry,
  type LeaveRequest,
  type LeaveStatus,
} from '@/services/leaves.service';
import { fileKeyFromValue, openStoredFile } from '@/services/files.service';
import { GrantCompOffDialog } from '@/components/leave/GrantCompOffDialog';
import { formatDisplayDate } from '@/utils/datetime';
import { currentMonthKey, monthLabel, shiftMonth } from '@/utils/month';

type TabValue = 'mine' | 'team' | 'calendar';

/** Opens a `file:<key>` attachment as an authed blob, or a plain URL directly. */
function openAttachment(value: string): void {
  const key = fileKeyFromValue(value);
  if (key) {
    void openStoredFile(key);
  } else {
    window.open(value, '_blank', 'noopener');
  }
}

function statusIcon(status: LeaveStatus) {
  if (status === 'APPROVED') return CheckCircle2;
  if (status === 'REJECTED') return XCircle;
  if (status === 'CANCELLED') return Ban;
  return Clock3;
}

export function LeavePage() {
  const { user, can } = useAuth();
  const canManage = can('leaves:manage');
  const canApplyOwn = can('leaves:own');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>(canApplyOwn ? 'mine' : 'team');
  const [applyOpen, setApplyOpen] = useState(false);
  const [compOffOpen, setCompOffOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(currentMonthKey());
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState<{
    request: LeaveRequest;
    status: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [decisionRemark, setDecisionRemark] = useState('');

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: () => leavesApi.types() });
  const balancesQuery = useQuery({
    queryKey: ['leave-balances', 'me'],
    queryFn: () => leavesApi.balances(),
    enabled: canApplyOwn,
  });
  const myLeavesQuery = useQuery({
    queryKey: ['leaves', 'mine', user?.id],
    queryFn: () => leavesApi.list({ userId: user?.id }),
    enabled: canApplyOwn && Boolean(user?.id),
  });
  const teamLeavesQuery = useQuery({
    queryKey: ['leaves', 'team'],
    queryFn: () => leavesApi.list(),
    enabled: canManage,
  });
  const calendarQuery = useQuery({
    queryKey: ['leaves', 'calendar', calendarMonth],
    queryFn: () => leavesApi.calendar(calendarMonth),
    enabled: canManage && tab === 'calendar',
  });

  const teamRequests = useMemo(() => teamLeavesQuery.data ?? [], [teamLeavesQuery.data]);
  const pendingTeam = useMemo(
    () => teamRequests.filter((row) => row.status === 'PENDING' && row.userId !== user?.id),
    [teamRequests, user?.id],
  );

  const activeRows = tab === 'mine' ? (myLeavesQuery.data ?? []) : teamRequests;

  const table = useClientTable({
    data: activeRows,
    getSearchText: (row) =>
      [
        row.employee?.fullName,
        row.employee?.employeeCode,
        row.leaveType?.code,
        row.leaveType?.name,
        row.status,
        row.reason,
        row.fromDate,
        row.toDate,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'employee') return row.employee?.fullName;
      if (key === 'type') return row.leaveType?.code;
      if (key === 'from') return row.fromDate;
      if (key === 'days') return row.days;
      if (key === 'status') return row.status;
      return undefined;
    },
    initialSortKey: 'from',
    initialSortDir: 'desc',
    pageSize: 20,
  });

  const leaveTypes = typesQuery.data ?? [];
  const hasPolicy = leaveTypes.length > 0;
  const canConfigurePolicy = can('leave-types:manage');

  async function invalidate(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leaves'] }),
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      // Without this the approved request lingers in the bell until the next poll.
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  }

  const decideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      leavesApi.decide(input.id, { status: input.status, decisionRemark: input.remark }),
    onSuccess: async (row) => {
      setDecision(null);
      setDecisionRemark('');
      setError(null);
      toast.success(
        row.status === 'APPROVED'
          ? 'Leave approved — attendance marked'
          : 'Leave request rejected',
      );
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => leavesApi.cancel(id),
    onSuccess: async () => {
      setDetail(null);
      setError(null);
      toast.success('Leave request cancelled');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const balances = balancesQuery.data?.balances ?? [];
  const paidBalances = balances.filter((b) => b.isPaid && !b.unlimited);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leave"
        description="Apply, track balance and approve your team's leave. Approved leave marks attendance automatically."
        actions={
          <>
            {canManage && hasPolicy ? (
              <Button variant="secondary" onClick={() => setCompOffOpen(true)}>
                <Gift size={15} />
                Grant comp-off
              </Button>
            ) : null}
            {(canApplyOwn || canManage) && hasPolicy ? (
              <Button size="lg" onClick={() => setApplyOpen(true)}>
                <CalendarPlus size={15} />
                Apply for leave
              </Button>
            ) : null}
          </>
        }
      />

      <GrantCompOffDialog open={compOffOpen} onClose={() => setCompOffOpen(false)} />

      {/* No leave types configured yet — nobody can apply until the policy exists. */}
      {!typesQuery.isLoading && !hasPolicy ? (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
            <ScrollText size={22} />
          </div>
          <p className="text-sm font-bold text-[var(--color-ink)]">No leave policy configured</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
            {canConfigurePolicy
              ? 'Add your leave types (Casual, Sick, Earned…) with their yearly quota. Until then nobody can apply for leave.'
              : 'Ask an administrator to set up the leave types and quota for your company.'}
          </p>
          {canConfigurePolicy ? (
            <Link to="/attendance-leave?tab=policy" className="mt-4 inline-block">
              <Button size="sm">
                <ScrollText size={14} />
                Set up leave policy
              </Button>
            </Link>
          ) : null}
        </Card>
      ) : null}

      {error && !applyOpen && !decision ? <Alert message={error} /> : null}

      {/* ── Balance cards ─────────────────────────────────────────────────── */}
      {canApplyOwn && balances.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((balance) => (
            <Card key={balance.leaveTypeId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: balance.colorHex }}
                      aria-hidden
                    />
                    <p className="truncate text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                      {balance.code}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {balance.name}
                  </p>
                </div>
                {!balance.isPaid ? <Badge tone="neutral">Unpaid</Badge> : null}
              </div>

              {balance.unlimited ? (
                <>
                  <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[var(--color-ink)]">
                    {balance.used}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    days taken · no fixed quota
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span
                      className="text-2xl font-bold tracking-tight tabular-nums"
                      style={{ color: balance.colorHex }}
                    >
                      {balance.remaining}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      / {balance.entitled} left
                    </span>
                  </p>
                  <Meter
                    className="mt-2.5"
                    value={balance.used}
                    total={balance.entitled}
                    pending={balance.pending}
                    color={balance.colorHex}
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                    {balance.used} used
                    {balance.pending > 0 ? ` · ${balance.pending} pending` : ''}
                  </p>
                </>
              )}
            </Card>
          ))}
        </div>
      ) : null}

      {canApplyOwn && paidBalances.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Paid entitlement"
            value={paidBalances.reduce((sum, b) => sum + b.entitled, 0)}
            hint={`${balancesQuery.data?.year ?? ''} calendar year`}
            icon={CalendarRange}
          />
          <StatTile
            label="Used"
            value={paidBalances.reduce((sum, b) => sum + b.used, 0)}
            hint="Approved days"
            icon={CheckCircle2}
            tone="primary"
          />
          <StatTile
            label="Awaiting approval"
            value={balances.reduce((sum, b) => sum + b.pending, 0)}
            hint="Days in pending requests"
            icon={Clock3}
            tone="warning"
          />
        </div>
      ) : null}

      {/* ── Requests ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              ...(canApplyOwn
                ? [{ value: 'mine' as TabValue, label: 'My requests', icon: User }]
                : []),
              ...(canManage
                ? [
                    {
                      value: 'team' as TabValue,
                      label: 'Team requests',
                      icon: Inbox,
                      count: pendingTeam.length,
                    },
                    { value: 'calendar' as TabValue, label: 'Team calendar', icon: Users },
                  ]
                : []),
            ]}
          />
          {tab === 'calendar' ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Previous month"
                onClick={() => setCalendarMonth((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="min-w-[9rem] text-center text-xs font-bold text-[var(--color-ink)]">
                {monthLabel(calendarMonth)}
              </span>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Next month"
                onClick={() => setCalendarMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          ) : null}
        </div>

        {tab === 'calendar' ? (
          <TeamLeaveCalendar
            month={calendarMonth}
            loading={calendarQuery.isLoading}
            entries={calendarQuery.data?.items ?? []}
          />
        ) : (
          <>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder={tab === 'mine' ? 'Search my leave…' : 'Search team leave…'}
        />

        <DataTable
          loading={tab === 'mine' ? myLeavesQuery.isLoading : teamLeavesQuery.isLoading}
          columns={[
            ...(tab === 'team'
              ? [{ key: 'employee', label: 'Employee', sortable: true }]
              : []),
            { key: 'type', label: 'Type', sortable: true },
            { key: 'from', label: 'Dates', sortable: true },
            { key: 'days', label: 'Days', sortable: true, className: 'text-right' },
            { key: 'reason', label: 'Reason' },
            { key: 'status', label: 'Status', sortable: true },
            { key: 'actions', label: '' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          empty={
            table.rows.length === 0 ? (
              <EmptyState
                title={tab === 'mine' ? 'No leave requests yet' : 'Nothing from your team'}
                description={
                  tab === 'mine'
                    ? 'Apply for leave and it lands in your manager’s inbox.'
                    : 'Team leave requests will appear here for approval.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => {
            const StatusIcon = statusIcon(row.status);
            const isOwn = row.userId === user?.id;
            return (
              <tr
                key={row.id}
                className="transition-colors hover:bg-[var(--color-bg)]/60"
              >
                {tab === 'team' ? (
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.employee?.fullName ?? '?'} userId={row.employee?.id} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.employee?.fullName ?? '—'}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {row.employee?.employeeCode ?? row.employee?.role}
                        </p>
                      </div>
                    </div>
                  </Td>
                ) : null}
                <Td>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      background: `color-mix(in srgb, ${row.leaveType?.colorHex ?? '#64748b'} 14%, transparent)`,
                      color: row.leaveType?.colorHex ?? 'var(--color-muted)',
                    }}
                  >
                    {row.leaveType?.code ?? '—'}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  <p className="text-xs font-semibold">{formatDisplayDate(row.fromDate)}</p>
                  {row.fromDate !== row.toDate ? (
                    <p className="text-[11px] text-[var(--color-muted)]">
                      → {formatDisplayDate(row.toDate)}
                    </p>
                  ) : row.dayPart !== 'FULL' ? (
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {DAY_PART_LABEL[row.dayPart]}
                    </p>
                  ) : null}
                </Td>
                <Td className="text-right font-semibold">{row.days}</Td>
                <Td className="max-w-[220px]">
                  <span className="line-clamp-2 text-xs text-[var(--color-muted)]">
                    {row.reason}
                  </span>
                  {row.attachmentUrl ? (
                    <button
                      type="button"
                      onClick={() => openAttachment(row.attachmentUrl!)}
                      className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)] hover:opacity-80"
                    >
                      <Paperclip size={10} />
                      Attachment
                    </button>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={LEAVE_STATUS_TONE[row.status]}>
                    <span className="inline-flex items-center gap-1">
                      <StatusIcon size={11} />
                      {row.status}
                    </span>
                  </Badge>
                  {/* Why it was approved / rejected — the employee should not have to open the request. */}
                  {row.decisionRemark ? (
                    <p
                      className="mt-1 line-clamp-2 max-w-[200px] text-[11px] text-[var(--color-muted)]"
                      title={row.decisionRemark}
                      data-testid="decision-remark"
                    >
                      “{row.decisionRemark}”{row.approvedBy ? ` — ${row.approvedBy.fullName}` : ''}
                    </p>
                  ) : null}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage && row.status === 'PENDING' && !isOwn ? (
                      <>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => setDecision({ request: row, status: 'APPROVED' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDecision({ request: row, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setDetail(row)}>
                      View
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
          </>
        )}
      </Card>

      {/* ── Apply — the shared form with the live day count ───────────── */}
      <LeaveApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} />

      {/* ── Approve / reject modal ───────────────────────────────────────── */}
      <Modal
        open={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setDecisionRemark('');
        }}
        title={decision?.status === 'APPROVED' ? 'Approve leave' : 'Reject leave'}
        description={
          decision?.status === 'APPROVED'
            ? 'Attendance for those working days is marked as Leave automatically.'
            : 'The employee sees your remark on their request.'
        }
        icon={decision?.status === 'APPROVED' ? CheckCircle2 : XCircle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDecision(null);
                setDecisionRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={decision?.status === 'APPROVED' ? 'primary' : 'destructive'}
              loading={decideMutation.isPending}
              // A rejection is always explained to the employee.
              disabled={decision?.status === 'REJECTED' && decisionRemark.trim().length < 3}
              onClick={() =>
                decision &&
                decideMutation.mutate({
                  id: decision.request.id,
                  status: decision.status,
                  remark: decisionRemark.trim() || undefined,
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
              label="Type"
              value={`${decision.request.leaveType?.code} — ${decision.request.leaveType?.name}`}
            />
            <DetailRow
              label="Dates"
              value={`${formatDisplayDate(decision.request.fromDate)} → ${formatDisplayDate(decision.request.toDate)}`}
            />
            <DetailRow label="Working days" value={decision.request.days} />
            <DetailRow label="Reason" value={decision.request.reason} />
          </dl>
        ) : null}
        {decision?.status === 'REJECTED' ? (
          <Textarea
            label="Reason for rejection"
            required
            value={decisionRemark}
            onChange={(e) => setDecisionRemark(e.target.value)}
            placeholder="Month-end closing — please take it next week."
            hint="The employee sees this on their request."
          />
        ) : (
          <Textarea
            label="Remark"
            optional
            value={decisionRemark}
            onChange={(e) => setDecisionRemark(e.target.value)}
            placeholder="Approved — hand over your beat to Amit."
          />
        )}
      </Modal>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Leave request"
        badge={detail?.status}
        icon={CalendarRange}
        footer={
          detail &&
          (detail.userId === user?.id || canManage) &&
          (detail.status === 'PENDING' || detail.status === 'APPROVED') ? (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button
                variant="danger"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(detail.id)}
              >
                <Ban size={14} />
                Cancel request
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
          )
        }
      >
        {error ? <Alert message={error} /> : null}
        {detail ? (
          <dl>
            <DetailRow label="Employee" value={detail.employee?.fullName} />
            <DetailRow label="Employee code" value={detail.employee?.employeeCode} mono />
            <DetailRow
              label="Leave type"
              value={`${detail.leaveType?.code} — ${detail.leaveType?.name}`}
            />
            <DetailRow label="From" value={formatDisplayDate(detail.fromDate)} />
            <DetailRow label="To" value={formatDisplayDate(detail.toDate)} />
            <DetailRow label="Duration" value={DAY_PART_LABEL[detail.dayPart]} />
            {detail.dayPart === 'SHORT' ? (
              <DetailRow label="Hours" value={detail.hours ? `${detail.hours} h` : null} />
            ) : null}
            <DetailRow label="Working days" value={detail.days} />
            <DetailRow label="Reason" value={detail.reason} />
            <DetailRow label="Contact" value={detail.contactPhone} mono />
            <DetailRow
              label="Document"
              value={
                detail.attachmentUrl ? (
                  <button
                    type="button"
                    onClick={() => openAttachment(detail.attachmentUrl!)}
                    className="cursor-pointer text-[var(--color-primary)] underline"
                  >
                    Open
                  </button>
                ) : null
              }
            />
            <DetailRow label="Applied on" value={formatDisplayDate(detail.createdAt.slice(0, 10))} />
            <DetailRow label="Decided by" value={detail.approvedBy?.fullName} />
            <DetailRow label="Decision remark" value={detail.decisionRemark} />
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}

/**
 * Month grid of who is off when — grouped by date, one row per day that has
 * anybody on leave. Days where more than one person is out are highlighted,
 * because that is the day the territory goes uncovered.
 */
function TeamLeaveCalendar({
  month,
  entries,
  loading,
}: {
  month: string;
  entries: LeaveCalendarEntry[];
  loading: boolean;
}) {
  const days = useMemo(() => {
    const [yearRaw, monRaw] = month.split('-').map(Number);
    const year = yearRaw ?? new Date().getFullYear();
    const mon = monRaw ?? 1;
    const daysInMonth = new Date(year, mon, 0).getDate();

    const byDate = new Map<string, LeaveCalendarEntry[]>();
    for (let dayNo = 1; dayNo <= daysInMonth; dayNo += 1) {
      const iso = `${month}-${String(dayNo).padStart(2, '0')}`;
      const onLeave = entries.filter((row) => row.fromDate <= iso && iso <= row.toDate);
      if (onLeave.length > 0) byDate.set(iso, onLeave);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [month, entries]);

  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-xs text-[var(--color-muted)]">
        Loading team calendar…
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <EmptyState
        title="Nobody on leave"
        description={`No approved or pending leave touches ${monthLabel(month)}.`}
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {days.map(([date, dayEntries]) => {
        const distinctPeople = new Set(dayEntries.map((row) => row.userId)).size;
        const crowded = distinctPeople > 1;
        return (
          <li
            key={date}
            className={
              crowded
                ? 'relative bg-[var(--color-warning-soft)]/40 px-4 py-3'
                : 'relative px-4 py-3'
            }
          >
            {crowded ? (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-warning)]"
              />
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex w-40 shrink-0 items-center gap-2">
                <CalendarDays size={14} className="text-[var(--color-muted)]" />
                <span className="text-xs font-bold text-[var(--color-ink)]">
                  {formatDisplayDate(date)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {dayEntries.map((row, index) => (
                  <span
                    key={`${row.userId}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-0.5 pr-2.5 pl-0.5"
                    title={`${row.fullName} · ${row.leaveType.code} · ${row.status}`}
                  >
                    <Avatar name={row.fullName} userId={row.userId} size="sm" />
                    <span className="max-w-[9rem] truncate text-[11px] font-semibold text-[var(--color-ink)]">
                      {row.fullName}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: `color-mix(in srgb, ${row.leaveType.color} 14%, transparent)`,
                        color: row.leaveType.color,
                      }}
                    >
                      {row.leaveType.code}
                      {row.dayPart !== 'FULL' ? ' ·½' : ''}
                    </span>
                    {row.status === 'PENDING' ? <Badge tone="warning">Pending</Badge> : null}
                  </span>
                ))}
              </div>
              {crowded ? (
                <span className="shrink-0 rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-warning)]">
                  {distinctPeople} people off
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
