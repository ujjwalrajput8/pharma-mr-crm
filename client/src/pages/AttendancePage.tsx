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
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              Today · {user?.fullName}
            </p>
            <p className="mt-1 text-base font-semibold">
              {today?.checkInAt
                ? `In ${new Date(today.checkInAt).toLocaleTimeString()}${
                    today.checkOutAt
                      ? ` · Out ${new Date(today.checkOutAt).toLocaleTimeString()}`
                      : ''
                  }`
                : today?.status === 'ABSENT'
                  ? 'Marked absent'
                  : 'Not checked in'}
            </p>
            {today?.workingHours != null ? (
              <p className="text-sm text-[var(--color-muted)]">Hours: {today.workingHours}</p>
            ) : null}
            {today?.status ? (
              <div className="mt-2">
                <Badge tone={statusTone[today.status]}>{today.status}</Badge>
              </div>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              onClick={() => checkInMutation.mutate()}
              disabled={
                Boolean(today?.checkInAt && !today.checkOutAt) ||
                today?.status === 'ABSENT' ||
                checkInMutation.isPending
              }
            >
              Check-in
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => checkOutMutation.mutate()}
              disabled={
                !today?.checkInAt || Boolean(today.checkOutAt) || checkOutMutation.isPending
              }
            >
              Check-out
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed p-4 text-sm text-[var(--color-muted)]">
          Admin accounts do not check in. Use <strong>Mark / update</strong> to set Present, Late, or
          Absent for MRs and Managers.
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
        title="Manage attendance"
        description="Set Present, Late, Absent, Leave, etc. for a field user."
        footer={
          <>
            <Button variant="secondary" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button
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
              {manageMutation.isPending ? 'Saving…' : 'Save mark'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Person"
            required
            value={manageForm.userId}
            onChange={(e) => setManageForm((p) => ({ ...p, userId: e.target.value }))}
            className="sm:col-span-2"
          >
            <option value="">Select MR / Manager</option>
            {fieldUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.role})
              </option>
            ))}
          </Select>
          <Input
            label="Date"
            type="text"
            required
            value={manageForm.attDate}
            onChange={(e) => setManageForm((p) => ({ ...p, attDate: e.target.value }))}
            placeholder="YYYY-MM-DD"
            hint="Use YYYY-MM-DD"
          />
          <Select
            label="Status"
            required
            value={manageForm.status}
            onChange={(e) =>
              setManageForm((p) => ({ ...p, status: e.target.value as AttendanceMarkStatus }))
            }
          >
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="LEAVE">Leave</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="OFFICE">Office</option>
            <option value="JOINT_WORK">Joint work</option>
            <option value="FLAGGED">Flagged</option>
          </Select>
          <Input
            label="Remarks"
            className="sm:col-span-2"
            value={manageForm.remarks}
            onChange={(e) => setManageForm((p) => ({ ...p, remarks: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
