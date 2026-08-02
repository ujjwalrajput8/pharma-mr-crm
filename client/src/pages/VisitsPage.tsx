import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/api/client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { visitsApi } from '@/services/visits.service';

export function VisitsPage() {
  const { can } = useAuth();
  const isAdmin = can('visits:manage');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const visitsQuery = useQuery({ queryKey: ['visits'], queryFn: () => visitsApi.list() });

  const deleteMutation = useMutation({
    mutationFn: visitsApi.remove,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAdmin ? 'Visit Management' : 'My Visits'}
        description="Visits are created only when an appointment is completed (Complete + Visit)."
      />

      {error ? <Alert message={error} /> : null}

      <Card className="border-dashed p-4 text-sm text-[var(--color-muted)]">
        To log a visit: go to Appointments → open a PENDING appointment → click{' '}
        <strong>Complete + Visit</strong>. Sample distribution there reduces stock automatically.
      </Card>

      <Card>
        <DataTable
          columns={['Visit Date', 'Time', 'Doctor', 'MR', 'Products', 'Follow-up', 'Actions']}
          loading={visitsQuery.isLoading}
          empty={
            !visitsQuery.isLoading && visitsQuery.data?.length === 0 ? (
              <EmptyState
                title="No visits logged"
                description="Complete an appointment to create the first visit."
              />
            ) : null
          }
        >
          {visitsQuery.data?.map((visit) => (
            <tr key={visit.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{visit.visitDate}</Td>
              <Td>{visit.visitTime ?? '—'}</Td>
              <Td>{visit.doctor?.fullName ?? '—'}</Td>
              <Td>{visit.mr?.fullName ?? '—'}</Td>
              <Td>{visit.products.map((p) => p.name).join(', ') || '—'}</Td>
              <Td>{visit.nextFollowUp ?? '—'}</Td>
              <Td>
                <Button
                  variant="danger"
                  className="!px-2.5 !py-1.5 text-xs"
                  onClick={() => {
                    if (window.confirm('Delete this visit?')) deleteMutation.mutate(visit.id);
                  }}
                >
                  Delete
                </Button>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
