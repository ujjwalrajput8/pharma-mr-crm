import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Inbox,
  Paperclip,
  Ban,
  Gift,
  ScrollText,
  User,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataTable, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal, FormSection } from '@/components/ui/Modal';
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
  type LeaveDayPart,
  type LeaveRequest,
  type LeaveStatus,
} from '@/services/leaves.service';
import { employeesApi } from '@/services/employees.service';
import { GrantCompOffDialog } from '@/components/leave/GrantCompOffDialog';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';

type TabValue = 'mine' | 'team';

const emptyForm = {
  leaveTypeId: '',
  fromDate: toIsoDate(new Date()),
  toDate: toIsoDate(new Date()),
  dayPart: 'FULL' as LeaveDayPart,
  reason: '',
  contactPhone: '',
  attachmentUrl: '',
  userId: '',
};

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
  const [form, setForm] = useState(emptyForm);
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
  // Filing on behalf of a team member needs the roster.
  const teamQuery = useQuery({
    queryKey: ['employees', 'roster'],
    queryFn: () => employeesApi.list(),
    enabled: canManage && applyOpen,
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

  const selectedType = leaveTypes.find((t) => String(t.id) === form.leaveTypeId);
  const selectedBalance = balancesQuery.data?.balances.find(
    (b) => String(b.leaveTypeId) === form.leaveTypeId,
  );

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

  const applyMutation = useMutation({
    mutationFn: leavesApi.apply,
    onSuccess: async () => {
      setApplyOpen(false);
      setForm(emptyForm);
      setError(null);
      toast.success('Leave request submitted');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

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

  function onApply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form.leaveTypeId) {
      setError('Pick a leave type');
      return;
    }
    applyMutation.mutate({
      leaveTypeId: Number(form.leaveTypeId),
      fromDate: form.fromDate,
      toDate: form.dayPart === 'FULL' ? form.toDate : form.fromDate,
      dayPart: form.dayPart,
      reason: form.reason.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      attachmentUrl: form.attachmentUrl.trim() || undefined,
      userId: form.userId ? Number(form.userId) : undefined,
    });
  }

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
            <Link to="/leave-policy" className="mt-4 inline-block">
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
                  ]
                : []),
            ]}
          />
        </div>

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
                      <Avatar name={row.employee?.fullName ?? '?'} size="sm" />
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
                </Td>
                <Td>
                  <Badge tone={LEAVE_STATUS_TONE[row.status]}>
                    <span className="inline-flex items-center gap-1">
                      <StatusIcon size={11} />
                      {row.status}
                    </span>
                  </Badge>
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
      </Card>

      {/* ── Apply modal ──────────────────────────────────────────────────── */}
      <Modal
        open={applyOpen}
        onClose={() => {
          setApplyOpen(false);
          setError(null);
        }}
        title="Apply for leave"
        description="Sundays and company holidays inside the range are not counted."
        icon={CalendarPlus}
        className="max-w-xl"
      >
        <form id="apply-leave-form" onSubmit={onApply} className="space-y-4">
          {error ? <Alert message={error} /> : null}

          <FormSection title="Leave details" icon={CalendarRange}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {canManage ? (
                <Select
                  label="Employee"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                  hint="Leave blank to apply for yourself"
                  className="sm:col-span-2"
                >
                  <option value="">Myself</option>
                  {(teamQuery.data ?? [])
                    .filter((member) => member.id !== user?.id)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName} ({member.employeeCode ?? member.role})
                      </option>
                    ))}
                </Select>
              ) : null}

              <Select
                label="Leave type"
                required
                value={form.leaveTypeId}
                onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
              >
                <option value="">Select…</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} — {type.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Duration"
                value={form.dayPart}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dayPart: e.target.value as LeaveDayPart }))
                }
                hint={
                  selectedType && !selectedType.allowHalfDay
                    ? `${selectedType.code} must be taken as full days`
                    : undefined
                }
              >
                <option value="FULL">Full day(s)</option>
                <option value="FIRST_HALF" disabled={selectedType?.allowHalfDay === false}>
                  First half
                </option>
                <option value="SECOND_HALF" disabled={selectedType?.allowHalfDay === false}>
                  Second half
                </option>
              </Select>

              <DatePicker
                label="From"
                required
                value={form.fromDate}
                onChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    fromDate: value,
                    toDate: f.toDate && f.toDate >= value ? f.toDate : value,
                  }))
                }
              />
              <DatePicker
                label="To"
                required
                value={form.dayPart === 'FULL' ? form.toDate : form.fromDate}
                disabled={form.dayPart !== 'FULL'}
                onChange={(value) => setForm((f) => ({ ...f, toDate: value }))}
              />
            </div>

            {selectedBalance && !selectedBalance.unlimited ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[var(--color-muted)]">
                    {selectedBalance.code} balance
                  </span>
                  <span style={{ color: selectedBalance.colorHex }}>
                    {selectedBalance.remaining - selectedBalance.pending} day(s) available
                  </span>
                </div>
                <Meter
                  className="mt-1.5"
                  value={selectedBalance.used}
                  total={selectedBalance.entitled}
                  pending={selectedBalance.pending}
                  color={selectedBalance.colorHex}
                />
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Reason & contact" icon={Paperclip}>
            <div className="space-y-3.5">
              <Textarea
                label="Reason"
                required
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Family function in Kanpur, back on Monday…"
              />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Input
                  label="Contact number while away"
                  optional
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="98765 43210"
                />
                <Input
                  label="Document link"
                  optional={!selectedType?.requiresProof}
                  required={selectedType?.requiresProof}
                  value={form.attachmentUrl}
                  onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
                  placeholder="https://…"
                  hint={
                    selectedType?.requiresProof
                      ? `${selectedType.code} needs a supporting document`
                      : 'Medical certificate etc.'
                  }
                />
              </div>
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setApplyOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={applyMutation.isPending}>
              Submit request
            </Button>
          </div>
        </form>
      </Modal>

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
        <Textarea
          label="Remark"
          optional
          value={decisionRemark}
          onChange={(e) => setDecisionRemark(e.target.value)}
          placeholder="Approved — hand over your beat to Amit."
        />
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
            <DetailRow label="Working days" value={detail.days} />
            <DetailRow label="Reason" value={detail.reason} />
            <DetailRow label="Contact" value={detail.contactPhone} mono />
            <DetailRow
              label="Document"
              value={
                detail.attachmentUrl ? (
                  <a
                    href={detail.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-primary)] underline"
                  >
                    Open
                  </a>
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
