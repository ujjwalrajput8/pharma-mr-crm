import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { VisitDetailsDialog } from '@/components/appointments/VisitDetailsDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { visitsApi, type Visit } from '@/services/visits.service';
import { formatDisplayDate, formatTime12 } from '@/utils/datetime';

export function VisitsPage() {
  const { can } = useAuth();
  const isAdmin = can('visits:manage');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Visit | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const visitsQuery = useQuery({ queryKey: ['visits'], queryFn: () => visitsApi.list() });

  const table = useClientTable({
    data: visitsQuery.data ?? [],
    getSearchText: (visit) =>
      [
        formatDisplayDate(visit.visitDate),
        visit.checkInTime
          ? formatTime12(visit.checkInTime)
          : visit.visitTime
            ? formatTime12(visit.visitTime)
            : '',
        visit.doctor?.fullName,
        visit.mr?.fullName,
        visit.meetingDurationMin ? `${visit.meetingDurationMin} min` : '',
        visit.visitOutcome,
        visit.nextFollowUp ? formatDisplayDate(visit.nextFollowUp) : '',
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'visitDate') return row.visitDate;
      if (key === 'time') return row.checkInTime ?? row.visitTime;
      if (key === 'doctor') return row.doctor?.fullName;
      if (key === 'mr') return row.mr?.fullName;
      if (key === 'duration') return row.meetingDurationMin ?? 0;
      if (key === 'outcome') return row.visitOutcome;
      if (key === 'followUp') return row.nextFollowUp;
      return undefined;
    },
    initialSortKey: 'visitDate',
    initialSortDir: 'desc',
  });

  const deleteMutation = useMutation({
    mutationFn: visitsApi.remove,
    onSuccess: async () => {
      setDeleteId(null);
      toast.success('Visit deleted');
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Delete failed', getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAdmin ? 'Visit Management' : 'My Visits'}
        description="Visits are created only when an appointment is completed (Complete + Visit)."
      />

      <Card className="border-dashed p-4 text-sm text-[var(--color-muted)]">
        To log a visit: go to Appointments or the Dashboard calendar → open a PENDING appointment →
        click <strong>Complete + Visit</strong>. Sample distribution there reduces stock automatically.
      </Card>

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search visits…"
        />
        <DataTable
          columns={[
            { key: 'visitDate', label: 'Visit Date', sortable: true },
            { key: 'time', label: 'Time', sortable: true },
            { key: 'doctor', label: 'Doctor', sortable: true },
            { key: 'mr', label: 'MR', sortable: true },
            { key: 'duration', label: 'Duration', sortable: true },
            { key: 'outcome', label: 'Outcome', sortable: true },
            { key: 'followUp', label: 'Follow-up', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={visitsQuery.isLoading}
          empty={
            !visitsQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No visits logged' : 'No matching visits'}
                description={
                  table.totalAll === 0
                    ? 'Complete an appointment to create the first visit.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((visit) => (
              <tr key={visit.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium">{formatDisplayDate(visit.visitDate)}</Td>
                <Td>
                  {visit.checkInTime
                    ? formatTime12(visit.checkInTime)
                    : visit.visitTime
                      ? formatTime12(visit.visitTime)
                      : '—'}
                </Td>
                <Td>{visit.doctor?.fullName ?? '—'}</Td>
                <Td>{visit.mr?.fullName ?? '—'}</Td>
                <Td>{visit.meetingDurationMin ? `${visit.meetingDurationMin} min` : '—'}</Td>
                <Td>{visit.visitOutcome || '—'}</Td>
                <Td>{visit.nextFollowUp ? formatDisplayDate(visit.nextFollowUp) : '—'}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelected(visit)}
                    >
                      View
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteId(visit.id)}
                    >
                      Delete
                    </Button>
                  </div>
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

      <VisitDetailsDialog
        open={Boolean(selected)}
        visit={selected}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        variant="delete"
        title="Confirm Delete"
        description="Are you sure you want to delete this visit record?"
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
