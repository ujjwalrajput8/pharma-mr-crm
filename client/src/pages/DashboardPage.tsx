import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  Package,
  Stethoscope,
  Users,
} from 'lucide-react';
import { AppointmentDetailsDialog } from '@/components/appointments/AppointmentDetailsDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { VisitCompleteDialog } from '@/components/appointments/VisitCompleteDialog';
import { VisitDetailsDialog } from '@/components/appointments/VisitDetailsDialog';
import {
  DashboardCalendar,
  type CalendarEventKind,
  type CalendarSelection,
} from '@/components/dashboard/DashboardCalendar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Card, PageHeader } from '@/components/ui/Page';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { getApiErrorMessage } from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { appointmentsApi, type Appointment, type CompleteAppointmentPayload } from '@/services/appointments.service';
import { dashboardApi } from '@/services/dashboard.service';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
import { usersApi } from '@/services/users.service';
import { visitsApi, type Visit } from '@/services/visits.service';

const adminCards: Array<{ key: string; label: string; to: string; icon: typeof Users }> = [
  { key: 'totalDoctors', label: 'Total Doctors', to: '/doctors', icon: Stethoscope },
  { key: 'totalMrs', label: 'Total MRs', to: '/users', icon: Users },
  { key: 'todaysAppointments', label: "Today's Appointments", to: '/appointments', icon: CalendarDays },
  { key: 'todaysVisits', label: "Today's Visits", to: '/visits', icon: ClipboardList },
  { key: 'pendingAppointments', label: 'Pending Appointments', to: '/appointments', icon: CalendarDays },
  { key: 'completedAppointments', label: 'Completed Appointments', to: '/appointments', icon: CalendarDays },
  { key: 'cancelledAppointments', label: 'Cancelled Appointments', to: '/appointments', icon: CalendarDays },
  { key: 'completedVisits', label: 'Completed Visits', to: '/visits', icon: ClipboardList },
  { key: 'medicineStock', label: 'Medicine Stock', to: '/stock', icon: Package },
  { key: 'medicineDistribution', label: 'Medicine Distribution', to: '/distributions', icon: Package },
  { key: 'monthlySales', label: 'Monthly Sales', to: '/sales', icon: Package },
  { key: 'companyTotalSales', label: 'Company Total Sales', to: '/sales', icon: Package },
];

const mrCards: Array<{ key: string; label: string; to: string; icon: typeof Users }> = [
  { key: 'todaysAppointments', label: "Today's Appointments", to: '/appointments', icon: CalendarDays },
  { key: 'todaysVisits', label: "Today's Visits", to: '/visits', icon: ClipboardList },
  { key: 'pendingFollowUps', label: 'Pending Follow-ups', to: '/visits', icon: ClipboardList },
  { key: 'assignedDoctors', label: 'Doctors Assigned', to: '/doctors', icon: Stethoscope },
  { key: 'samplesRemaining', label: 'Samples Remaining', to: '/distributions', icon: Package },
  { key: 'attendanceToday', label: 'Attendance', to: '/attendance', icon: Users },
  { key: 'monthlyPerformance', label: 'Monthly Performance', to: '/reports', icon: ClipboardList },
  { key: 'pendingAppointments', label: 'Pending Appointments', to: '/appointments', icon: CalendarDays },
];

export function DashboardPage() {
  const { user, can } = useAuth();
  const isAdmin = can('appointments:manage');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [slot, setSlot] = useState<CalendarSelection>({ date: '', time: '10:00' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', 'calendar'],
    queryFn: () => appointmentsApi.list({ limit: 100 }),
  });
  const visitsQuery = useQuery({
    queryKey: ['visits', 'calendar'],
    queryFn: () => visitsApi.list(),
  });
  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
    enabled: createOpen,
  });
  const mrsQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: createOpen && isAdmin,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: Boolean(completeFor),
  });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: async () => {
      setCreateOpen(false);
      toast.success('Appointment scheduled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Could not create appointment', getApiErrorMessage(err)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, date, time }: { id: number; date: string; time: string }) =>
      appointmentsApi.update(id, { date, time }),
    onSuccess: async () => {
      toast.success('Appointment rescheduled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Move failed', getApiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.updateStatus(id, 'CANCELLED'),
    onSuccess: async () => {
      setSelectedAppointment(null);
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
      setSelectedAppointment(null);
      toast.success('Visit logged', 'Stock updated for any samples distributed');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Visit save failed', getApiErrorMessage(err)),
  });

  const cards = user?.role === 'ADMIN' ? adminCards : mrCards;
  const values = summaryQuery.data?.cards ?? {};

  const appointmentMap = useMemo(() => {
    const map = new Map<number, Appointment>();
    appointmentsQuery.data?.forEach((item) => map.set(item.id, item));
    return map;
  }, [appointmentsQuery.data]);

  const visitMap = useMemo(() => {
    const map = new Map<number, Visit>();
    visitsQuery.data?.forEach((item) => map.set(item.id, item));
    return map;
  }, [visitsQuery.data]);

  function onEventClick(kind: CalendarEventKind, id: number) {
    if (kind === 'appointment') {
      setSelectedAppointment(appointmentMap.get(id) ?? null);
      return;
    }
    setSelectedVisit(visitMap.get(id) ?? null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.fullName}. Live ${
          user?.role === 'ADMIN' ? 'organization' : 'field'
        } overview with schedule calendar.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : cards.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.key} to={item.to}>
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                    <div className="mb-3 inline-flex rounded-xl bg-[var(--color-primary-soft)] p-2.5 text-[var(--color-primary)]">
                      <Icon size={18} />
                    </div>
                    <p className="text-sm text-[var(--color-muted)]">{item.label}</p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--color-ink)]">
                      {values[item.key] ?? 0}
                    </p>
                  </Card>
                </Link>
              );
            })}
      </div>

      {summaryQuery.data?.insights ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {summaryQuery.data.insights.topPerformingMrs?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-base font-semibold">Top Performing MR</h3>
              <ul className="space-y-2 text-sm">
                {summaryQuery.data.insights.topPerformingMrs.map((row) => (
                  <li key={row.mrId} className="flex justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                    <span>{row.fullName}</span>
                    <span className="text-[var(--color-muted)]">
                      {row.visits} visits · ₹{row.sales.toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.topPrescribedMedicines?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-base font-semibold">Top Prescribed / Sampled Medicines</h3>
              <ul className="space-y-2 text-sm">
                {summaryQuery.data.insights.topPrescribedMedicines.map((row) => (
                  <li key={row.medicineId} className="flex justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                    <span>{row.name}</span>
                    <span className="text-[var(--color-muted)]">{row.samples} samples</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.mrWiseSales?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-base font-semibold">MR-wise Sales</h3>
              <ul className="space-y-2 text-sm">
                {summaryQuery.data.insights.mrWiseSales.map((row) => (
                  <li key={row.mrId} className="flex justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                    <span>{row.fullName}</span>
                    <span className="font-medium">₹{row.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.medicineWiseSales?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-base font-semibold">Medicine-wise Sales</h3>
              <ul className="space-y-2 text-sm">
                {summaryQuery.data.insights.medicineWiseSales.map((row) => (
                  <li key={row.medicineId} className="flex justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                    <span>{row.name}</span>
                    <span className="font-medium">₹{row.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.performanceGraph?.length ? (
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-3 text-base font-semibold">Monthly Performance (visits/day)</h3>
              <div className="flex h-40 items-end gap-1">
                {summaryQuery.data.insights.performanceGraph.map((point) => {
                  const max = Math.max(
                    ...summaryQuery.data!.insights!.performanceGraph!.map((p) => p.visits),
                    1,
                  );
                  const height = Math.max(8, Math.round((point.visits / max) * 100));
                  return (
                    <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-[var(--color-primary)]"
                        style={{ height: `${height}%` }}
                        title={`${point.date}: ${point.visits}`}
                      />
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {point.date.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">Schedule Calendar</h3>
        <ErrorBoundary title="Calendar failed to load">
          <DashboardCalendar
            appointments={appointmentsQuery.data ?? []}
            visits={visitsQuery.data ?? []}
            onSelectSlot={(selection) => {
              setSlot(selection);
              setCreateOpen(true);
            }}
            onEventClick={onEventClick}
            onAppointmentMove={(id, date, time) => moveMutation.mutate({ id, date, time })}
          />
        </ErrorBoundary>
      </div>

      <AppointmentFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        doctors={doctorsQuery.data ?? []}
        mrs={mrsQuery.data ?? []}
        initialDate={slot.date}
        initialTime={slot.time}
        submitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />

      <AppointmentDetailsDialog
        open={Boolean(selectedAppointment)}
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onCancel={() => selectedAppointment && cancelMutation.mutate(selectedAppointment.id)}
        onComplete={() => {
          if (!selectedAppointment) return;
          setCompleteFor(selectedAppointment);
        }}
      />

      <VisitDetailsDialog
        open={Boolean(selectedVisit)}
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
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
    </div>
  );
}
