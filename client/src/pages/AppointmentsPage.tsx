import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarDays, CalendarX2, CheckCircle2, History, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { AppointmentDetailsDialog } from '@/components/appointments/AppointmentDetailsDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import {
  AppointmentRescheduleDialog,
  type ReschedulePayload,
} from '@/components/appointments/AppointmentRescheduleDialog';
import { LogVisitDialog } from '@/components/visits/LogVisitDialog';
import { Tabs } from '@/components/ui/Tabs';
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
  type AppointmentView,
  type CreateAppointmentPayload,
} from '@/services/appointments.service';
import { doctorsApi } from '@/services/doctors.service';
import { formatDisplayDate, formatTime12, toIsoDate } from '@/utils/datetime';

const statusTone: Record<AppointmentStatus, 'primary' | 'success' | 'danger' | 'warning' | 'neutral'> = {
  PENDING: 'primary',
  REQUESTED: 'primary',
  CONFIRMED: 'primary',
  COMPLETED: 'success',
  VISITED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'neutral',
  RESCHEDULED: 'warning',
};
const OPEN: AppointmentStatus[] = ['PENDING', 'RESCHEDULED', 'REQUESTED', 'CONFIRMED'];
const PAGE_SIZE = 20;

export function AppointmentsPage() {
  const { can, user, role } = useAuth();
  const canManage = can('appointments:manage');
  const canAssignMr = role === 'ADMIN' || role === 'MANAGER';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AppointmentView>('today');
  const [page, setPage] = useState(1);
  const [noShowFor, setNoShowFor] = useState<Appointment | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);

  // Server-side views + paging — nothing old is ever cut off (B-V7).
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', 'page', view, page],
    queryFn: () => appointmentsApi.page({ view, page, limit: PAGE_SIZE }),
  });
  const today = toIsoDate(new Date());
  const pageItems = appointmentsQuery.data?.items ?? [];
  const counts = appointmentsQuery.data?.meta.counts;
  const cancelAppointment = pageItems.find((item) => item.id === cancelId);
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
  const table = useClientTable({
    data: pageItems,
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

  const noShowMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.noShow(id),
    onSuccess: async () => {
      setNoShowFor(null);
      toast.success('Marked as no-show');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (err) => toast.error('Not changed', getApiErrorMessage(err)),
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
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <Tabs
            ariaLabel="Appointment views"
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(1);
            }}
            items={[
              { value: 'today', label: 'Today', icon: CalendarDays, count: counts?.today },
              { value: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: counts?.upcoming },
              { value: 'overdue', label: 'Overdue', icon: History, count: counts?.overdue },
              { value: 'completed', label: 'Completed', icon: CheckCircle2 },
              { value: 'closed', label: 'Cancelled / No-show', icon: CalendarX2 },
            ]}
          />
        </div>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search this page…"
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
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={statusTone[item.status] ?? 'neutral'}>{item.status.replace('_', '-')}</Badge>
                      {OPEN.includes(item.status) && item.date < today ? <Badge tone="warning">Overdue</Badge> : null}
                    </div>
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
                      {OPEN.includes(item.status) ? (
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
                            onClick={() => setNoShowFor(item)}
                          >
                            No-show
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
          page={page}
          totalPages={appointmentsQuery.data?.meta.totalPages ?? 1}
          from={(appointmentsQuery.data?.meta.total ?? 0) === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          to={Math.min(page * PAGE_SIZE, appointmentsQuery.data?.meta.total ?? 0)}
          total={appointmentsQuery.data?.meta.total ?? 0}
          pageSize={PAGE_SIZE}
          pageSizeOptions={[PAGE_SIZE]}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
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
        onCancel={() => {
          if (!selected) return;
          setCancelId(selected.id);
          setSelected(null);
        }}
        onReschedule={() => {
          if (!selected) return;
          setRescheduleFor(selected);
          setSelected(null);
        }}
        onComplete={() => {
          if (!selected) return;
          setCompleteFor(selected);
          setSelected(null);
        }}
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

      <LogVisitDialog
        mode={completeFor ? { kind: 'appointment', appointment: completeFor } : null}
        onClose={() => setCompleteFor(null)}
      />

      <ConfirmDialog
        open={Boolean(noShowFor)}
        variant="generic"
        badge="No-show"
        title="Mark as no-show?"
        description="The doctor was not met. The appointment closes; no visit is recorded."
        recordName={noShowFor?.doctor?.fullName ?? 'Appointment'}
        recordContext={noShowFor ? `Appointment · ${formatDisplayDate(noShowFor.date)}` : 'Appointments'}
        confirmLabel="Mark no-show"
        cancelLabel="Keep"
        onClose={() => setNoShowFor(null)}
        loading={noShowMutation.isPending}
        onConfirm={() => noShowFor && noShowMutation.mutate(noShowFor.id)}
      />

      <ConfirmDialog
        open={Boolean(cancelId)}
        variant="delete"
        badge="Cancel"
        title="Cancel this appointment?"
        description="The appointment will be marked cancelled. This action cannot be undone."
        recordName={cancelAppointment?.doctor?.fullName ?? 'Appointment'}
        recordContext={cancelAppointment ? `Appointment · ${formatDisplayDate(cancelAppointment.date)}` : 'Appointments'}
        confirmLabel="Cancel appointment"
        cancelLabel="Keep"
        onClose={() => setCancelId(null)}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
      />
    </div>
  );
}
