import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { AppointmentDetailsDialog } from '@/components/appointments/AppointmentDetailsDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { VisitCompleteDialog } from '@/components/appointments/VisitCompleteDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import {
  appointmentsApi,
  type Appointment,
  type AppointmentStatus,
  type CompleteAppointmentPayload,
  type CreateAppointmentPayload,
} from '@/services/appointments.service';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
import { usersApi } from '@/services/users.service';
import { formatDisplayDate, formatTime12 } from '@/utils/datetime';

const statusTone: Record<AppointmentStatus, 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'warning',
};

export function AppointmentsPage() {
  const { can, user } = useAuth();
  const isAdmin = can('appointments:manage');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', statusFilter],
    queryFn: () =>
      appointmentsApi.list({
        limit: 100,
        status: statusFilter || undefined,
      }),
  });
  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
    enabled: open,
  });
  const mrsQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: open && isAdmin,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: Boolean(completeFor),
  });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: async () => {
      setOpen(false);
      toast.success('Appointment created');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Create failed', getApiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.updateStatus(id, 'CANCELLED'),
    onSuccess: async () => {
      setCancelId(null);
      setSelected(null);
      toast.success('Appointment cancelled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Cancel failed', getApiErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompleteAppointmentPayload }) =>
      appointmentsApi.complete(id, payload),
    onSuccess: async () => {
      setCompleteFor(null);
      setSelected(null);
      toast.success('Visit logged', 'Samples reduced stock automatically');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Complete failed', getApiErrorMessage(err)),
  });

  const title = useMemo(
    () => (isAdmin ? 'Appointment Management' : 'My Appointments'),
    [isAdmin],
  );

  function onCreate(payload: CreateAppointmentPayload) {
    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description="Appointments schedule meetings only. Completing one opens the structured Visit form."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New Appointment
          </Button>
        }
      />

      <Card className="p-4">
        <div className="max-w-xs">
          <Select
            label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="RESCHEDULED">Rescheduled</option>
          </Select>
        </div>
      </Card>

      <Card>
        {appointmentsQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <DataTable
            columns={['Date', 'Time', 'Doctor', 'MR', 'Purpose', 'Status', 'Actions']}
            empty={
              appointmentsQuery.data?.length === 0 ? (
                <EmptyState
                  title="No appointments yet"
                  description="Schedule an appointment or pick a date on the dashboard calendar."
                />
              ) : null
            }
          >
            {appointmentsQuery.data?.map((item) => {
              return (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                  <Td className="font-medium">{formatDisplayDate(item.date)}</Td>
                  <Td>{formatTime12(item.time)}</Td>
                  <Td>{item.doctor?.fullName ?? '—'}</Td>
                  <Td>{item.mr?.fullName ?? '—'}</Td>
                  <Td>{item.purpose ?? '—'}</Td>
                  <Td>
                    <Badge tone={statusTone[item.status]}>{item.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1.5 text-xs"
                        onClick={() => setSelected(item)}
                      >
                        View
                      </Button>
                      {item.status === 'PENDING' || item.status === 'RESCHEDULED' ? (
                        <>
                          <Button
                            variant="primary"
                            className="!px-2.5 !py-1.5 text-xs"
                            onClick={() => setCompleteFor(item)}
                          >
                            Complete + Visit
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2.5 !py-1.5 text-xs"
                            onClick={() => setCancelId(item.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <AppointmentFormDialog
        open={open}
        onClose={() => setOpen(false)}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        doctors={doctorsQuery.data ?? []}
        mrs={mrsQuery.data ?? []}
        submitting={createMutation.isPending}
        onSubmit={onCreate}
      />

      <AppointmentDetailsDialog
        open={Boolean(selected)}
        appointment={selected}
        onClose={() => setSelected(null)}
        onCancel={() => selected && setCancelId(selected.id)}
        onComplete={() => selected && setCompleteFor(selected)}
      />

      <VisitCompleteDialog
        open={Boolean(completeFor)}
        appointment={completeFor}
        medicines={medicinesQuery.data ?? []}
        submitting={completeMutation.isPending}
        onClose={() => setCompleteFor(null)}
        onSubmit={(payload) =>
          completeFor && completeMutation.mutate({ id: completeFor.id, payload })
        }
      />

      <ConfirmDialog
        open={Boolean(cancelId)}
        variant="delete"
        title="Confirm Cancel"
        description="Are you sure you want to cancel this appointment? This action cannot be undone."
        confirmLabel="Cancel appointment"
        onClose={() => setCancelId(null)}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
      />
    </div>
  );
}
