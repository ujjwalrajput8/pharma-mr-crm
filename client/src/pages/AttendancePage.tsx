import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { attendanceApi } from '@/services/attendance.service';
import { useState } from 'react';

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
  });
  const listQuery = useQuery({
    queryKey: ['attendance', 'list'],
    queryFn: () => attendanceApi.list(),
  });

  const table = useClientTable({
    data: listQuery.data ?? [],
    getSearchText: (row) =>
      [
        row.workDate,
        row.mr?.fullName,
        row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString() : '',
        row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString() : '',
        row.workingHours,
        row.checkOutAt ? 'Complete' : row.checkInAt ? 'In progress' : 'Absent',
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.workDate;
      if (key === 'mr') return row.mr?.fullName;
      if (key === 'checkIn') return row.checkInAt;
      if (key === 'checkOut') return row.checkOutAt;
      if (key === 'hours') return row.workingHours;
      if (key === 'status') {
        return row.checkOutAt ? 'Complete' : row.checkInAt ? 'In progress' : 'Absent';
      }
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

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

  const today = todayQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description={`Check-in / check-out for ${user?.fullName}. Working hours calculated automatically.`}
      />
      {error ? <Alert message={error} /> : null}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-[var(--color-muted)]">Today</p>
          <p className="mt-1 text-lg font-semibold">
            {today?.checkInAt
              ? `In ${new Date(today.checkInAt).toLocaleTimeString()}${
                  today.checkOutAt ? ` · Out ${new Date(today.checkOutAt).toLocaleTimeString()}` : ''
                }`
              : 'Not checked in'}
          </p>
          {today?.workingHours != null ? (
            <p className="text-sm text-[var(--color-muted)]">Working hours: {today.workingHours}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => checkInMutation.mutate()}
            disabled={Boolean(today?.checkInAt && !today.checkOutAt) || checkInMutation.isPending}
          >
            Check-in
          </Button>
          <Button
            variant="secondary"
            onClick={() => checkOutMutation.mutate()}
            disabled={!today?.checkInAt || Boolean(today.checkOutAt) || checkOutMutation.isPending}
          >
            Check-out
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search attendance…"
        />
        <DataTable
          columns={[
            { key: 'date', label: 'Date', sortable: true },
            { key: 'mr', label: 'MR', sortable: true },
            { key: 'checkIn', label: 'Check-in', sortable: true },
            { key: 'checkOut', label: 'Check-out', sortable: true },
            { key: 'hours', label: 'Hours', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
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
                    ? 'Use Check-in to start today.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>{row.workDate}</Td>
              <Td>{row.mr?.fullName ?? '—'}</Td>
              <Td>{row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString() : '—'}</Td>
              <Td>{row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString() : '—'}</Td>
              <Td>{row.workingHours ?? '—'}</Td>
              <Td>
                <Badge tone={row.checkOutAt ? 'success' : row.checkInAt ? 'primary' : 'neutral'}>
                  {row.checkOutAt ? 'Complete' : row.checkInAt ? 'In progress' : 'Absent'}
                </Badge>
              </Td>
            </tr>
          ))}
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
    </div>
  );
}
