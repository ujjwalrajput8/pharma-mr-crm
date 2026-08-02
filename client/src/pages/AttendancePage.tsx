import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
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

      <Card>
        <DataTable
          columns={['Date', 'MR', 'Check-in', 'Check-out', 'Hours', 'Status']}
          loading={listQuery.isLoading}
          empty={
            !listQuery.isLoading && listQuery.data?.length === 0 ? (
              <EmptyState title="No attendance yet" description="Use Check-in to start today." />
            ) : null
          }
        >
          {listQuery.data?.map((row) => (
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
      </Card>
    </div>
  );
}
