import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { AppointmentDetailsDialog } from '@/components/appointments/AppointmentDetailsDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import {
  AppointmentRescheduleDialog,
  type ReschedulePayload,
} from '@/components/appointments/AppointmentRescheduleDialog';
import { VisitCompleteDialog } from '@/components/appointments/VisitCompleteDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
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
import { formatDisplayDate, formatTime12 } from '@/utils/datetime';

const statusTone: Record<AppointmentStatus, 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'warning',
};

export function AppointmentsPage() {
  const { can, user, role } = useAuth();
  const canManage = can('appointments:manage');
  const canAssignMr = role === 'ADMIN' || role === 'MANAGER';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);
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
    queryKey: ['appointments', 'assignable-mrs'],
    queryFn: () => appointmentsApi.listAssignableMrs(),
    enabled: open && canAssignMr,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: Boolean(completeFor),
  });

  const table = useClientTable({
    data: appointmentsQuery.data ?? [],
    getSearchText: (item) =>
      [
        formatDisplayDate(item.date),
        formatTime12(item.time),
        item.doctor?.fullName,
        item.mr?.fullName,
        item.purpose,
        item.status,
        item.createdBy?.fullName,
        item.assignedBy?.fullName,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.date;
      if (key === 'time') return row.time;
      if (key === 'doctor') return row.doctor?.fullName;
      if (key === 'mr') return row.mr?.fullName;
      if (key === 'purpose') return row.purpose;
      if (key === 'status') return row.status;
      if (key === 'createdBy') return row.createdBy?.fullName;
      if (key === 'assignedBy') return row.assignedBy?.fullName;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
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

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReschedulePayload }) =>
      appointmentsApi.reschedule(id, payload),
    onSuccess: async () => {
      setRescheduleFor(null);
      setSelected(null);
      toast.success('Appointment rescheduled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Reschedule failed', getApiErrorMessage(err)),
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

  const title = useMemo(() => {
    if (role === 'ADMIN') return 'Appointment Management';
    if (role === 'MANAGER') return 'Team Appointments';
    return 'My Appointments';
  }, [role]);

  const columns = useMemo(() => {
    const base = [
      { key: 'date', label: 'Date', sortable: true },
      { key: 'time', label: 'Time', sortable: true },
      { key: 'doctor', label: 'Doctor', sortable: true },
    ];
    if (canManage) {
      base.push({ key: 'mr', label: 'MR', sortable: true });
    }
    base.push(
      { key: 'purpose', label: 'Purpose', sortable: true },
      { key: 'status', label: 'Status', sortable: true },
    );
    if (canManage) {
      base.push(
        { key: 'createdBy', label: 'Created by', sortable: true },
        { key: 'assignedBy', label: 'Assigned by', sortable: true },
      );
    }
    base.push({ key: 'actions', label: 'Actions', sortable: false });
    return base;
  }, [canManage]);

  function onCreate(payload: CreateAppointmentPayload) {
    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={
          canAssignMr
            ? 'Create for yourself or assign to an MR. Created by / Assigned by is visible here.'
            : 'Your appointments only. Completing one opens the Visit form.'
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New Appointment
          </Button>
        }
      />

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search appointments…"
          actions={
            <select
              className="h-9 w-full sm:w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-ink)] outline-none shadow-xs transition focus:border-[var(--color-primary)] cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RESCHEDULED">Rescheduled</option>
            </select>
          }
        />
        <DataTable
          columns={columns}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={appointmentsQuery.isLoading}
          empty={
            !appointmentsQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={
                  table.totalAll === 0 ? 'No appointments yet' : 'No matching appointments'
                }
                description={
                  table.totalAll === 0
                    ? 'Schedule an appointment or pick a date on the dashboard calendar.'
                    : 'Try a different search term or status filter.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((item) => {
              return (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                  <Td className="font-medium">{formatDisplayDate(item.date)}</Td>
                  <Td>{formatTime12(item.time)}</Td>
                  <Td>{item.doctor?.fullName ?? '—'}</Td>
                  {canManage ? <Td>{item.mr?.fullName ?? '—'}</Td> : null}
                  <Td>{item.purpose ?? '—'}</Td>
                  <Td>
                    <Badge tone={statusTone[item.status]}>{item.status}</Badge>
                  </Td>
                  {canManage ? (
                    <>
                      <Td>
                        <div className="text-sm">{item.createdBy?.fullName ?? '—'}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {item.createdBy?.role ?? ''}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-sm">
                          {item.assignedBy?.fullName ?? 'Self-booked'}
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {item.assignedBy?.role ?? ''}
                        </div>
                      </Td>
                    </>
                  ) : null}
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(item)}
                      >
                        View
                      </Button>
                      {item.status === 'PENDING' || item.status === 'RESCHEDULED' ? (
                        <>
                          <Button
                            variant="soft"
                            size="sm"
                            onClick={() => setRescheduleFor(item)}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setCompleteFor(item)}
                          >
                            Complete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
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

      <AppointmentFormDialog
        open={open}
        onClose={() => setOpen(false)}
        canAssignMr={canAssignMr}
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
        onReschedule={() => {
          if (!selected) return;
          setRescheduleFor(selected);
          setSelected(null);
        }}
        onComplete={() => selected && setCompleteFor(selected)}
      />

      <AppointmentRescheduleDialog
        open={Boolean(rescheduleFor)}
        appointment={rescheduleFor}
        submitting={rescheduleMutation.isPending}
        onClose={() => setRescheduleFor(null)}
        onSubmit={(payload) =>
          rescheduleFor && rescheduleMutation.mutate({ id: rescheduleFor.id, payload })
        }
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
