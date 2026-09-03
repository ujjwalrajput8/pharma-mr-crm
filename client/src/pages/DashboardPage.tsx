import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Package,
  Stethoscope,
  Trophy,
  Users,
} from 'lucide-react';
import { AppointmentDetailsDialog } from '@/components/appointments/AppointmentDetailsDialog';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import {
  AppointmentRescheduleDialog,
  type ReschedulePayload,
} from '@/components/appointments/AppointmentRescheduleDialog';
import { VisitCompleteDialog } from '@/components/appointments/VisitCompleteDialog';
import { VisitDetailsDialog } from '@/components/appointments/VisitDetailsDialog';
import {
  DashboardCalendar,
  type CalendarEventKind,
  type CalendarSelection,
} from '@/components/dashboard/DashboardCalendar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Card, PageHeader } from '@/components/ui/Page';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { getApiErrorMessage } from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { appointmentsApi, type Appointment, type CompleteAppointmentPayload } from '@/services/appointments.service';
import { dashboardApi } from '@/services/dashboard.service';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
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
  const { user, can, canAny, role } = useAuth();
  const canManage = can('appointments:manage');
  const canAssignMr = role === 'ADMIN' || role === 'MANAGER';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [slot, setSlot] = useState<CalendarSelection>({ date: '', time: '10:00' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);

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
    queryKey: ['appointments', 'assignable-mrs'],
    queryFn: () => appointmentsApi.listAssignableMrs(),
    enabled: createOpen && canAssignMr,
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
      appointmentsApi.reschedule(id, { date, time }),
    onSuccess: async () => {
      toast.success('Appointment rescheduled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Move failed', getApiErrorMessage(err)),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReschedulePayload }) =>
      appointmentsApi.reschedule(id, payload),
    onSuccess: async () => {
      setRescheduleFor(null);
      setSelectedAppointment(null);
      toast.success('Appointment rescheduled');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error('Reschedule failed', getApiErrorMessage(err)),
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

  const cards = user?.role === 'ADMIN' || user?.role === 'MANAGER' ? adminCards : mrCards;
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
        description={`Welcome back, ${user?.fullName}. ${
          user?.role === 'ADMIN'
            ? 'Organization'
            : user?.role === 'MANAGER'
              ? 'Team'
              : 'Field'
        } overview with schedule calendar.`}
      />

      <NeedsAttention />

      {/* Quick shortcuts pill strip */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
        <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider px-3 hidden sm:inline">
          Quick Actions
        </span>
        {can('myday:own') ? (
          <Link
            to="/my-day"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95 shadow-2xs"
          >
            ☀️ My Day
          </Link>
        ) : null}
        {can('approvals:team') ? (
          <Link
            to="/approvals"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95 shadow-2xs"
          >
            ✓ Approvals
          </Link>
        ) : null}
        {canAny(['tour-plan:own', 'tour-plan:manage']) ? (
          <Link
            to="/tour-plan"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95 shadow-2xs"
          >
            🗺️ Tour Plan
          </Link>
        ) : null}
        {can('mystock:own') ? (
          <Link
            to="/my-stock"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95 shadow-2xs"
          >
            📦 My Stock
          </Link>
        ) : null}
        {can('ledger:view') ? (
          <Link
            to="/ledger"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95 shadow-2xs"
          >
            📒 Ledger
          </Link>
        ) : null}
      </div>

      {/* Modern Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : cards.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.key} to={item.to} className="group">
                  <Card className="relative h-full overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                        {item.label}
                      </p>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
                        <Icon size={14} />
                      </span>
                    </div>
                    {(() => {
                      const val = values[item.key];
                      const shown =
                        typeof val === 'number'
                          ? item.key.toLowerCase().includes('sales')
                            ? `₹${val.toLocaleString('en-IN')}`
                            : val.toLocaleString('en-IN')
                          : (val ?? 0);
                      return (
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                          {shown}
                        </p>
                      );
                    })()}
                    <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-muted)]/70 transition-colors group-hover:text-[var(--color-primary)]">
                      Open
                      <ChevronRight size={10} />
                    </span>
                  </Card>
                </Link>
              );
            })}
      </div>

      {summaryQuery.data?.insights ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {summaryQuery.data.insights.topPerformingMrs?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
                <Trophy size={13} className="mb-px inline text-[var(--color-warning)]" /> Top
                performing MR
              </h3>
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {summaryQuery.data.insights.topPerformingMrs.map((row) => (
                  <li key={row.mrId} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-[var(--color-ink)]">{row.fullName}</span>
                    <span className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2.5 py-1 rounded-full">
                      {row.visits} visits · ₹{row.sales.toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.topPrescribedMedicines?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
                💊 Top Prescribed / Sampled Medicines
              </h3>
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {summaryQuery.data.insights.topPrescribedMedicines.map((row) => (
                  <li key={row.medicineId} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-[var(--color-ink)]">{row.name}</span>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
                      {row.samples} samples
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.mrWiseSales?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
                💼 MR-wise Sales
              </h3>
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {summaryQuery.data.insights.mrWiseSales.map((row) => (
                  <li key={row.mrId} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-[var(--color-ink)]">{row.fullName}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{row.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.medicineWiseSales?.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
                🧪 Medicine-wise Sales
              </h3>
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {summaryQuery.data.insights.medicineWiseSales.map((row) => (
                  <li key={row.medicineId} className="flex justify-between items-center py-2.5">
                    <span className="font-semibold text-[var(--color-ink)]">{row.name}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹{row.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {summaryQuery.data.insights.performanceGraph?.length ? (
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  <BarChart3 size={13} className="mb-px inline text-[var(--color-primary)]" />{' '}
                  Monthly performance (visits / day)
                </h3>
                <span className="text-xs text-[var(--color-muted)] font-medium">Daily activity breakdown</span>
              </div>
              <div className="flex h-44 items-end gap-1.5 pt-4">
                {summaryQuery.data.insights.performanceGraph.map((point) => {
                  const max = Math.max(
                    ...summaryQuery.data!.insights!.performanceGraph!.map((p) => p.visits),
                    1,
                  );
                  const height = Math.max(10, Math.round((point.visits / max) * 100));
                  return (
                    <div key={point.date} className="group relative flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                      <div className="absolute -top-7 hidden group-hover:block z-10 rounded-md bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-surface)] shadow-sm whitespace-nowrap">
                        {point.date}: {point.visits} visits
                      </div>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-primary-hover)] transition-all duration-200 group-hover:brightness-110 group-hover:shadow-xs"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] font-semibold text-[var(--color-muted)]">
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
            showMrName={canManage}
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
        canAssignMr={canAssignMr}
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
        onReschedule={() => {
          if (!selectedAppointment) return;
          setRescheduleFor(selectedAppointment);
          setSelectedAppointment(null);
        }}
        onComplete={() => {
          if (!selectedAppointment) return;
          setCompleteFor(selectedAppointment);
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
