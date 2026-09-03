import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  PencilLine,
  Table2,
  Timer,
  UserCheck,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select, Textarea } from '@/components/ui/Field';
import { MonthCalendar, type MonthCalendarCell } from '@/components/ui/MonthCalendar';
import { Modal } from '@/components/ui/Modal';
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
  ATTENDANCE_STATUS_META,
  WORK_TYPE_LABEL,
  attendanceApi,
  readGeolocation,
  type Attendance,
  type AttendanceCalendarDay,
  type AttendanceMarkStatus,
  type WorkType,
} from '@/services/attendance.service';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';
import { currentMonthKey, monthAnchorDate } from '@/utils/month';

type TabValue = 'calendar' | 'register';

const MARK_OPTIONS: AttendanceMarkStatus[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'LEAVE',
  'HOLIDAY',
  'OFFICE',
  'JOINT_WORK',
  'FLAGGED',
];

const LEGEND = [
  { label: 'Present', color: 'var(--color-success)' },
  { label: 'Late', color: 'var(--color-warning)' },
  { label: 'Absent', color: 'var(--color-danger)' },
  { label: 'Leave', color: 'var(--color-cal-visit)' },
  { label: 'Holiday / weekly off', color: 'var(--color-muted)' },
];

function clockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AttendancePage() {
  const { user, can } = useAuth();
  const canManage = can('attendance:manage');
  const canSelfMark = can('attendance:own');
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>('calendar');
  const [month, setMonth] = useState(currentMonthKey());
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(
    canSelfMark ? undefined : undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<AttendanceCalendarDay | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageForm, setManageForm] = useState({
    userId: '',
    attDate: toIsoDate(new Date()),
    status: 'ABSENT' as AttendanceMarkStatus,
    workType: '' as WorkType | '',
    remarks: '',
  });

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
    enabled: canSelfMark,
  });
  const fieldUsersQuery = useQuery({
    queryKey: ['attendance', 'field-users'],
    queryFn: () => attendanceApi.fieldUsers(),
    enabled: canManage,
  });
  const calendarQuery = useQuery({
    queryKey: ['attendance', 'calendar', month, selectedUserId ?? user?.id],
    queryFn: () =>
      attendanceApi.calendar({ userId: selectedUserId, month: monthAnchorDate(month) }),
    enabled: Boolean(selectedUserId) || canSelfMark,
  });
  const listQuery = useQuery({
    queryKey: ['attendance', 'list', selectedUserId],
    queryFn: () => attendanceApi.list({ userId: selectedUserId }),
  });

  const fieldUsers = fieldUsersQuery.data ?? [];
  const today = todayQuery.data;

  /** Admin has no personal register, so they must pick somebody first. */
  const needsUserPick = isAdmin && !selectedUserId;

  const calendarCells: MonthCalendarCell[] = useMemo(() => {
    const days = calendarQuery.data?.days ?? [];
    return days.map((day) => {
      if (day.status) {
        const meta = ATTENDANCE_STATUS_META[day.status];
        return {
          date: day.date,
          label: day.holiday && day.status === 'HOLIDAY' ? day.holiday.name : meta.label,
          meta: day.workingHours ? `${day.workingHours} h` : clockTimeShort(day.checkInAt),
          color: meta.color,
          muted: day.status === 'HOLIDAY',
          flagged: Boolean(day.flagReason),
          title: day.flagReason ?? day.remarks ?? undefined,
        };
      }
      if (day.holiday) {
        return {
          date: day.date,
          label: day.holiday.name,
          color: 'var(--color-muted)',
          muted: true,
          title: day.holiday.isOptional ? 'Optional holiday' : day.holiday.type,
        };
      }
      if (day.isSunday) {
        return { date: day.date, label: 'Weekly off', color: 'var(--color-muted)', muted: true };
      }
      if (day.isFuture) {
        return { date: day.date, muted: true, disabled: true };
      }
      return { date: day.date, label: 'Not marked', color: null, muted: false };
    });
  }, [calendarQuery.data]);

  const summary = calendarQuery.data?.summary;

  const table = useClientTable({
    data: listQuery.data ?? [],
    getSearchText: (row) =>
      [row.workDate, row.mr?.fullName, row.mr?.email, row.status, row.workType, row.remarks]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.workDate;
      if (key === 'person') return row.mr?.fullName;
      if (key === 'checkIn') return row.checkInAt;
      if (key === 'hours') return row.workingHours;
      if (key === 'status') return row.status;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
    pageSize: 20,
  });

  async function invalidate(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  }

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const position = await readGeolocation();
      return attendanceApi.checkIn({
        ...position,
        deviceAt: new Date().toISOString(),
        workType: 'FIELD',
        locationNote: 'Field check-in',
      });
    },
    onSuccess: async (row) => {
      setError(null);
      if (row.flagReason) {
        toast.warning('Checked in — flagged for review', row.flagReason);
      } else {
        toast.success(
          row.status === 'LATE' ? 'Checked in (marked late)' : 'Checked in',
          `at ${clockTime(row.checkInAt)}`,
        );
      }
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceApi.checkOut(),
    onSuccess: async (row) => {
      setError(null);
      toast.success('Checked out', `${row.workingHours ?? 0} h logged`);
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const manageMutation = useMutation({
    mutationFn: attendanceApi.manage,
    onSuccess: async () => {
      setManageOpen(false);
      setError(null);
      toast.success('Attendance updated');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openManageFor(date?: string): void {
    setManageForm({
      userId: selectedUserId ? String(selectedUserId) : (fieldUsers[0]?.id?.toString() ?? ''),
      attDate: date ?? toIsoDate(new Date()),
      status: 'ABSENT',
      workType: '',
      remarks: '',
    });
    setDayDetail(null);
    setManageOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description="GPS check-in, monthly register and manager corrections. Approved leave and holidays fill in automatically."
        actions={
          canManage ? (
            <Button variant="secondary" onClick={() => openManageFor()}>
              <PencilLine size={15} />
              Mark / correct
            </Button>
          ) : null
        }
      />

      {error ? <Alert message={error} /> : null}

      {/* ── Today card ───────────────────────────────────────────────────── */}
      {canSelfMark ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: today
                    ? `color-mix(in srgb, ${ATTENDANCE_STATUS_META[today.status].color} 14%, transparent)`
                    : 'var(--color-bg)',
                  color: today
                    ? ATTENDANCE_STATUS_META[today.status].color
                    : 'var(--color-muted)',
                }}
              >
                {today?.checkOutAt ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}
              </span>
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <h3 className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight">
                  {today
                    ? today.checkOutAt
                      ? 'Day closed'
                      : 'Checked in'
                    : 'Not checked in yet'}
                  {today ? (
                    <Badge tone={ATTENDANCE_STATUS_META[today.status].tone}>
                      {ATTENDANCE_STATUS_META[today.status].label}
                    </Badge>
                  ) : null}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <LogIn size={12} /> In {clockTime(today?.checkInAt ?? null)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <LogOut size={12} /> Out {clockTime(today?.checkOutAt ?? null)}
                  </span>
                  {today?.workingHours ? (
                    <span className="inline-flex items-center gap-1">
                      <Timer size={12} /> {today.workingHours} h
                    </span>
                  ) : null}
                  {today?.accuracyM ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> ±{Math.round(today.accuracyM)} m
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!today?.checkInAt ? (
                <Button loading={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
                  <MapPin size={15} />
                  Check in
                </Button>
              ) : !today.checkOutAt ? (
                <Button
                  variant="secondary"
                  loading={checkOutMutation.isPending}
                  onClick={() => checkOutMutation.mutate()}
                >
                  <LogOut size={15} />
                  Check out
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)]">
                  <CheckCircle2 size={14} /> {today.workingHours ?? 0} h logged today
                </span>
              )}
            </div>
          </div>

          {today?.flagReason ? (
            <div className="mt-3.5">
              <Alert tone="warning" message={`Flagged: ${today.flagReason}`} />
            </div>
          ) : null}
        </Card>
      ) : (
        <Alert
          tone="primary"
          message="Admin accounts do not mark personal check-in — pick an employee below to review or correct their register."
        />
      )}

      {/* ── Month summary ────────────────────────────────────────────────── */}
      {summary && !needsUserPick ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            label="Present"
            value={(summary.PRESENT ?? 0) + (summary.LATE ?? 0)}
            hint={`of ${summary.workingDays} working days`}
            icon={UserCheck}
            tone="success"
          />
          <StatTile
            label="Late"
            value={summary.LATE ?? 0}
            hint="After shift grace"
            icon={Clock3}
            tone="warning"
          />
          <StatTile
            label="Absent"
            value={summary.ABSENT ?? 0}
            hint="Unmarked / marked absent"
            icon={AlertTriangle}
            tone="danger"
          />
          <StatTile
            label="On leave"
            value={summary.LEAVE ?? 0}
            hint="Approved leave days"
            icon={CalendarDays}
            tone="primary"
          />
          <StatTile
            label="Hours logged"
            value={summary.workingHours}
            hint="This month"
            icon={Timer}
          />
        </div>
      ) : null}

      {/* ── Calendar / register ──────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'calendar', label: 'Register', icon: CalendarDays },
              { value: 'register', label: 'All entries', icon: Table2 },
            ]}
          />
          {canManage && fieldUsers.length > 0 ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
              <span className="whitespace-nowrap">Employee</span>
              <select
                value={selectedUserId ?? ''}
                onChange={(e) =>
                  setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)
                }
                className="h-9 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-ink)] shadow-xs outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
              >
                <option value="">{canSelfMark ? 'Myself' : 'Select employee…'}</option>
                {fieldUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.employeeCode ?? member.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {tab === 'calendar' ? (
          <div className="p-4">
            {needsUserPick ? (
              <EmptyState
                title="Pick an employee"
                description="Choose a team member above to open their monthly attendance register."
              />
            ) : (
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                cells={calendarCells}
                onSelect={(cell) =>
                  setDayDetail(
                    calendarQuery.data?.days.find((day) => day.date === cell.date) ?? null,
                  )
                }
                legend={LEGEND}
                loading={calendarQuery.isFetching}
              />
            )}
          </div>
        ) : (
          <>
            <TableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              placeholder="Search attendance…"
            />
            <DataTable
              loading={listQuery.isLoading}
              columns={[
                { key: 'date', label: 'Date', sortable: true },
                ...(canManage ? [{ key: 'person', label: 'Employee', sortable: true }] : []),
                { key: 'checkIn', label: 'In', sortable: true },
                { key: 'checkOut', label: 'Out' },
                { key: 'hours', label: 'Hours', sortable: true, className: 'text-right' },
                { key: 'work', label: 'Work type' },
                { key: 'status', label: 'Status', sortable: true },
              ]}
              sortKey={table.sortKey}
              sortDir={table.sortDir}
              onSort={table.toggleSort}
              empty={
                table.rows.length === 0 ? (
                  <EmptyState
                    title="No attendance yet"
                    description="Entries appear here once the team starts checking in."
                  />
                ) : null
              }
            >
              {table.rows.map((row: Attendance) => {
                const meta = ATTENDANCE_STATUS_META[row.status];
                return (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
                    <Td className="whitespace-nowrap font-semibold">
                      {formatDisplayDate(row.workDate)}
                    </Td>
                    {canManage ? (
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.mr?.fullName ?? '?'} size="sm" />
                          <span className="truncate text-sm font-medium">
                            {row.mr?.fullName ?? '—'}
                          </span>
                        </div>
                      </Td>
                    ) : null}
                    <Td className="font-mono text-xs">{clockTime(row.checkInAt)}</Td>
                    <Td className="font-mono text-xs">{clockTime(row.checkOutAt)}</Td>
                    <Td className="text-right font-semibold">{row.workingHours ?? '—'}</Td>
                    <Td className="text-xs text-[var(--color-muted)]">
                      {row.workType ? WORK_TYPE_LABEL[row.workType] : '—'}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {row.flagReason ? (
                          <span title={row.flagReason} className="inline-flex">
                            <AlertTriangle size={13} className="text-[var(--color-warning)]" />
                          </span>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
            <TablePagination
              page={table.page}
              totalPages={table.totalPages}
              from={table.from}
              to={table.to}
              total={table.filteredTotal}
              pageSize={table.pageSize}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </>
        )}
      </Card>

      {/* ── Day detail ───────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(dayDetail)}
        onClose={() => setDayDetail(null)}
        title={dayDetail ? formatDisplayDate(dayDetail.date) : 'Day'}
        description="Attendance recorded for this date."
        icon={CalendarDays}
        badge={dayDetail?.status ?? (dayDetail?.holiday ? 'HOLIDAY' : undefined)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDayDetail(null)}>
              Close
            </Button>
            {canManage && dayDetail && !dayDetail.isFuture ? (
              <Button onClick={() => openManageFor(dayDetail.date)}>
                <PencilLine size={14} />
                Correct this day
              </Button>
            ) : null}
          </>
        }
      >
        {dayDetail ? (
          <dl>
            <DetailRow
              label="Status"
              value={dayDetail.status ? ATTENDANCE_STATUS_META[dayDetail.status].label : null}
            />
            <DetailRow
              label="Work type"
              value={dayDetail.workType ? WORK_TYPE_LABEL[dayDetail.workType] : null}
            />
            <DetailRow label="Check in" value={clockTime(dayDetail.checkInAt)} mono />
            <DetailRow label="Check out" value={clockTime(dayDetail.checkOutAt)} mono />
            <DetailRow
              label="Hours"
              value={dayDetail.workingHours ? `${dayDetail.workingHours} h` : null}
            />
            <DetailRow label="Holiday" value={dayDetail.holiday?.name} />
            <DetailRow label="Weekly off" value={dayDetail.isSunday ? 'Sunday' : null} />
            <DetailRow label="Remarks" value={dayDetail.remarks} />
            <DetailRow label="Flag" value={dayDetail.flagReason} />
          </dl>
        ) : null}
      </Modal>

      {/* ── Manage / correct ─────────────────────────────────────────────── */}
      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Mark / correct attendance"
        description="Use this for missed check-ins, office days and joint work. Approved-leave days can only be changed by cancelling the leave."
        icon={PencilLine}
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={manageMutation.isPending}
              onClick={() =>
                manageMutation.mutate({
                  userId: Number(manageForm.userId),
                  attDate: manageForm.attDate,
                  status: manageForm.status,
                  workType: manageForm.workType || undefined,
                  remarks: manageForm.remarks.trim() || undefined,
                })
              }
              disabled={!manageForm.userId}
            >
              Save entry
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        <div className="space-y-3.5">
          <Select
            label="Employee"
            required
            value={manageForm.userId}
            onChange={(e) => setManageForm((f) => ({ ...f, userId: e.target.value }))}
          >
            <option value="">Select…</option>
            {fieldUsers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} ({member.employeeCode ?? member.role})
              </option>
            ))}
          </Select>

          <DatePicker
            label="Date"
            required
            value={manageForm.attDate}
            onChange={(value) => setManageForm((f) => ({ ...f, attDate: value }))}
          />

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select
              label="Status"
              required
              value={manageForm.status}
              onChange={(e) =>
                setManageForm((f) => ({ ...f, status: e.target.value as AttendanceMarkStatus }))
              }
            >
              {MARK_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {ATTENDANCE_STATUS_META[status].label}
                </option>
              ))}
            </Select>

            <Select
              label="Work type"
              optional
              value={manageForm.workType}
              onChange={(e) =>
                setManageForm((f) => ({ ...f, workType: e.target.value as WorkType | '' }))
              }
              hint="Left blank, it follows the status"
            >
              <option value="">Auto</option>
              {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((type) => (
                <option key={type} value={type}>
                  {WORK_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Remarks"
            optional
            value={manageForm.remarks}
            onChange={(e) => setManageForm((f) => ({ ...f, remarks: e.target.value }))}
            placeholder="Phone died in the field — check-in confirmed on call."
          />
        </div>
      </Modal>
    </div>
  );
}

function clockTimeShort(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
