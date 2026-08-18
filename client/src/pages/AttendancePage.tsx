import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import {
  attendanceApi,
  type Attendance,
  type AttendanceMarkStatus,
} from '@/services/attendance.service';

const statusTone: Record<AttendanceMarkStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  LEAVE: 'neutral',
  HOLIDAY: 'neutral',
  OFFICE: 'primary',
  JOINT_WORK: 'primary',
  FLAGGED: 'warning',
};

function displayStatus(row: Attendance): AttendanceMarkStatus {
  if (row.status) return row.status;
  if (row.checkOutAt) return 'PRESENT';
  if (row.checkInAt) return 'PRESENT';
  return 'ABSENT';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { user, can } = useAuth();
  const canManage = can('attendance:manage');
  const canSelfMark = can('attendance:own');
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageForm, setManageForm] = useState({
    userId: '',
    attDate: todayIso(),
    status: 'ABSENT' as AttendanceMarkStatus,
    remarks: '',
  });

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
    enabled: canSelfMark,
  });
  const listQuery = useQuery({
    queryKey: ['attendance', 'list'],
    queryFn: () => attendanceApi.list(),
  });
  const usersQuery = useQuery({
    queryKey: ['attendance', 'field-users'],
    queryFn: () => attendanceApi.fieldUsers(),
    enabled: canManage && manageOpen,
  });

  const fieldUsers = usersQuery.data ?? [];

  const table = useClientTable({
    data: listQuery.data ?? [],
    getSearchText: (row) =>
      [row.workDate, row.mr?.fullName, row.mr?.email, displayStatus(row), row.remarks]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.workDate;
      if (key === 'person') return row.mr?.fullName;
      if (key === 'checkIn') return row.checkInAt;
      if (key === 'checkOut') return row.checkOutAt;
      if (key === 'hours') return row.workingHours;
      if (key === 'status') return displayStatus(row);
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  const stats = useMemo(() => {
    const rows = listQuery.data ?? [];
    return {
      present: rows.filter((r) => displayStatus(r) === 'PRESENT').length,
      late: rows.filter((r) => displayStatus(r) === 'LATE').length,
      absent: rows.filter((r) => displayStatus(r) === 'ABSENT').length,
    };
  }, [listQuery.data]);

  const checkInMutation = useMutation({
    mutationFn: () => attendanceApi.checkIn({ locationNote: 'Field check-in' }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceApi.checkOut(),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const manageMutation = useMutation({
    mutationFn: attendanceApi.manage,
    onSuccess: async () => {
      setError(null);
      setManageOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const today = todayQuery.data;

  const pageDescription = isAdmin
    ? 'View and manage field-force attendance. Admins do not mark personal check-in.'
    : canManage
      ? 'Mark your own attendance and manage your team register.'
      : 'Check-in / check-out for your field day.';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        description={pageDescription}
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setManageForm({
                  userId: '',
                  attDate: todayIso(),
                  status: 'ABSENT',
                  remarks: '',
                });
                setManageOpen(true);
              }}
            >
              Mark / update
            </Button>
          ) : null
        }
      />
      {error ? <Alert message={error} /> : null}

      {canManage ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Present (listed)" value={stats.present} />
          <StatTile label="Late" value={stats.late} />
          <StatTile label="Absent" value={stats.absent} />
        </div>
      ) : null}

      {canSelfMark ? (
        <Card className="relative overflow-hidden border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-primary-soft)]/30 p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-sm">
                <span className="text-lg font-bold">📍</span>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase flex items-center gap-1.5">
                  <span>Today's Field Attendance</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                  <span>{user?.fullName}</span>
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-base font-bold text-[var(--color-ink)]">
                    {today?.checkInAt
                      ? `Clocked In ${new Date(today.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${
                          today.checkOutAt
                            ? ` · Out ${new Date(today.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ' (Active)'
                        }`
                      : today?.status === 'ABSENT'
                        ? 'Marked Absent'
                        : 'Not Checked In Yet'}
                  </p>
                  {today?.status ? (
                    <Badge tone={statusTone[today.status]}>{today.status}</Badge>
                  ) : null}
                </div>
                {today?.workingHours != null ? (
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Logged Working Hours: <span className="font-semibold text-[var(--color-ink)]">{today.workingHours} hrs</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                className="w-full sm:w-auto shadow-xs"
                onClick={() => checkInMutation.mutate()}
                loading={checkInMutation.isPending}
                disabled={
                  Boolean(today?.checkInAt && !today.checkOutAt) ||
                  today?.status === 'ABSENT' ||
                  checkInMutation.isPending
                }
              >
                Punch In (Check-in)
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => checkOutMutation.mutate()}
                loading={checkOutMutation.isPending}
                disabled={
                  !today?.checkInAt || Boolean(today.checkOutAt) || checkOutMutation.isPending
                }
              >
                Punch Out (Check-out)
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed p-4 text-xs leading-relaxed text-[var(--color-muted)] bg-[var(--color-surface)]/50">
          Admin workspace accounts do not mark personal check-in. Use <strong>Mark / update</strong> to record attendance statuses (Present, Late, Absent, Leave) for field team members.
        </Card>
      )}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search by name, date, status…"
        />
        <DataTable
          columns={[
            { key: 'date', label: 'Date', sortable: true },
            { key: 'person', label: canManage ? 'Person' : 'Name', sortable: true },
            { key: 'checkIn', label: 'Check-in', sortable: true },
            { key: 'checkOut', label: 'Check-out', sortable: true },
            { key: 'hours', label: 'Hours', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
            ...(canManage ? [{ key: 'actions', label: 'Actions' }] : []),
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={listQuery.isLoading}
          empty={
            !listQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No attendance yet' : 'No matching records'}
                description={
                  table.totalAll === 0
                    ? canSelfMark
                      ? 'Use Check-in to start today.'
                      : 'Mark attendance for field users to populate the register.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => {
            const status = displayStatus(row);
            return (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium tabular-nums">{row.workDate}</Td>
                <Td>
                  <div className="font-medium">{row.mr?.fullName ?? '—'}</div>
                  {row.mr?.role ? (
                    <div className="text-[11px] text-[var(--color-muted)]">{row.mr.role}</div>
                  ) : null}
                </Td>
                <Td>{row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString() : '—'}</Td>
                <Td>{row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString() : '—'}</Td>
                <Td>{row.workingHours ?? '—'}</Td>
                <Td>
                  <Badge tone={statusTone[status]}>{status}</Badge>
                </Td>
                {canManage ? (
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setManageForm({
                            userId: String(row.userId ?? row.mrId),
                            attDate: row.workDate,
                            status: 'LATE',
                            remarks: row.remarks ?? '',
                          });
                          setManageOpen(true);
                        }}
                      >
                        Late
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setManageForm({
                            userId: String(row.userId ?? row.mrId),
                            attDate: row.workDate,
                            status: 'ABSENT',
                            remarks: row.remarks ?? '',
                          });
                          setManageOpen(true);
                        }}
                      >
                        Absent
                      </Button>
                    </div>
                  </Td>
                ) : null}
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
          pageSizeOptions={table.pageSizeOptions}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage Field Attendance"
        description="Update or override attendance status for a field representative with justification notes."
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={manageMutation.isPending}
              disabled={!manageForm.userId || manageMutation.isPending}
              onClick={() =>
                manageMutation.mutate({
                  userId: Number(manageForm.userId),
                  attDate: manageForm.attDate,
                  status: manageForm.status,
                  remarks: manageForm.remarks || undefined,
                })
              }
            >
              {manageMutation.isPending ? 'Saving Record…' : 'Save Attendance Mark'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <Select
              label="Select Field Staff"
              required
              value={manageForm.userId}
              onChange={(e) => setManageForm((p) => ({ ...p, userId: e.target.value }))}
            >
              <option value="">Choose Medical Representative or Manager</option>
              {fieldUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </Select>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Attendance Date"
                type="text"
                required
                value={manageForm.attDate}
                onChange={(e) => setManageForm((p) => ({ ...p, attDate: e.target.value }))}
                placeholder="YYYY-MM-DD"
                hint="Format: YYYY-MM-DD"
              />
              <Select
                label="Marked Status"
                required
                value={manageForm.status}
                onChange={(e) =>
                  setManageForm((p) => ({ ...p, status: e.target.value as AttendanceMarkStatus }))
                }
              >
                <option value="PRESENT">🟢 Present (Full Day)</option>
                <option value="LATE">🟡 Late (Half Day / Late Arrival)</option>
                <option value="ABSENT">🔴 Absent (Unapproved)</option>
                <option value="LEAVE">⚪ Leave (Approved Leave)</option>
                <option value="HOLIDAY">🔵 Holiday / Sunday</option>
                <option value="OFFICE">🏢 Office Meeting / Training</option>
                <option value="JOINT_WORK">🤝 Joint Field Work</option>
                <option value="FLAGGED">⚠️ Flagged for Audit</option>
              </Select>
            </div>

            <Input
              label="Manager Remarks / Justification"
              placeholder="e.g. Approved leave for medical reasons, joint fieldwork in Kanpur..."
              value={manageForm.remarks}
              onChange={(e) => setManageForm((p) => ({ ...p, remarks: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
