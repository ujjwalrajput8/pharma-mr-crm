import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { VisitDetailsDialog } from '@/components/appointments/VisitDetailsDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { TableSkeleton } from '@/components/ui/Skeleton';
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
        {visitsQuery.isLoading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            columns={['Visit Date', 'Time', 'Doctor', 'MR', 'Duration', 'Outcome', 'Follow-up', 'Actions']}
            empty={
              visitsQuery.data?.length === 0 ? (
                <EmptyState
                  title="No visits logged"
                  description="Complete an appointment to create the first visit."
                />
              ) : null
            }
          >
            {visitsQuery.data?.map((visit) => (
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
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => setSelected(visit)}
                    >
                      View
                    </Button>
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => setDeleteId(visit.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
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
