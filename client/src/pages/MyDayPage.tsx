import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Map,
  PartyPopper,
  Phone,
  Plane,
  Stethoscope,
  Store,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState, StatTile } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/store/AuthContext';
import { ATTENDANCE_STATUS_META, WORK_TYPE_LABEL, type AttendanceMarkStatus, type WorkType } from '@/services/attendance.service';
import { myDayApi } from '@/services/myday.service';
import { formatDisplayDate, formatTime12 } from '@/utils/datetime';

const APPOINTMENT_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
  CONFIRMED: 'primary',
  COMPLETED: 'success',
  VISITED: 'success',
  PENDING: 'warning',
  REQUESTED: 'warning',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
  CANCELLED: 'danger',
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function MyDayPage() {
  const { user } = useAuth();
  const snapshotQuery = useQuery({ queryKey: ['my-day'], queryFn: () => myDayApi.get() });
  const day = snapshotQuery.data;

  const firstName = user?.fullName.split(' ')[0] ?? '';
  const attendance = day?.attendance ?? null;
  const attendanceMeta = attendance
    ? ATTENDANCE_STATUS_META[attendance.status as AttendanceMarkStatus]
    : null;
  const plan = day?.tourPlanDay ?? null;
  const doneCalls = plan?.calls.filter((c) => c.done).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">
            {greeting()}, {firstName}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)] sm:text-sm">
            {day ? formatDisplayDate(day.date) : formatDisplayDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <Sun size={20} />
        </span>
      </div>

      {snapshotQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* ── Context banners ────────────────────────────────────────────── */}
          {day?.holidayToday ? (
            <Card className="flex items-center gap-3 p-4">
              <PartyPopper size={18} className="shrink-0 text-[var(--color-warning)]" />
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Today is a holiday — {day.holidayToday}
              </p>
            </Card>
          ) : null}
          {day?.leaveToday ? (
            <Card className="flex items-center gap-3 p-4">
              <Plane size={18} className="shrink-0 text-[var(--color-danger)]" />
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                You are on approved {day.leaveToday.leaveType?.name ?? 'leave'} today
                {day.leaveToday.fromDate !== day.leaveToday.toDate
                  ? ` (till ${formatDisplayDate(day.leaveToday.toDate)})`
                  : ''}
              </p>
            </Card>
          ) : null}

          {/* ── Check-in ───────────────────────────────────────────────────── */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${attendanceMeta?.color ?? 'var(--color-muted)'} 14%, transparent)`,
                    color: attendanceMeta?.color ?? 'var(--color-muted)',
                  }}
                >
                  <Clock3 size={18} />
                </span>
                <div className="min-w-0">
                  {attendance?.checkInAt ? (
                    <>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                        Checked in at {clock(attendance.checkInAt)}
                        <Badge tone={attendanceMeta?.tone ?? 'neutral'}>
                          {attendanceMeta?.label ?? attendance.status}
                        </Badge>
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        {attendance.checkOutAt
                          ? `Checked out at ${clock(attendance.checkOutAt)}`
                          : 'Not checked out yet'}
                        {attendance.workType
                          ? ` · ${WORK_TYPE_LABEL[attendance.workType as WorkType]}`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[var(--color-ink)]">Not checked in yet</p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        Check in with GPS before your first call.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <Link to="/attendance">
                <Button size="sm" variant={attendance?.checkInAt ? 'secondary' : 'primary'}>
                  <Clock3 size={13} />
                  {attendance?.checkInAt ? 'Attendance' : 'Check in'}
                </Button>
              </Link>
            </div>
          </Card>

          {/* ── Stat tiles ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Appointments today"
              value={day?.counts.appointmentsToday ?? 0}
              icon={CalendarCheck2}
              tone="primary"
            />
            <StatTile
              label="Visits this month"
              value={day?.counts.visitsThisMonth ?? 0}
              icon={ClipboardList}
              tone="success"
            />
          </div>

          {/* ── Today's plan ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Today's plan"
              description={
                plan
                  ? `${WORK_TYPE_LABEL[plan.workType]}${plan.territory ? ` · ${plan.territory.name}` : ''}${
                      plan.calls.length > 0 ? ` · ${doneCalls}/${plan.calls.length} calls done` : ''
                    }`
                  : 'From your approved monthly tour plan'
              }
              actions={
                <Link to="/tour-plan">
                  <Button size="sm" variant="ghost">
                    <Map size={13} />
                    Tour plan
                  </Button>
                </Link>
              }
            />
            {plan ? (
              <div className="px-4 py-3">
                {plan.jointWith ? (
                  <p className="mb-2 text-[11px] font-semibold text-[var(--color-muted)]">
                    Joint work with {plan.jointWith.fullName}
                  </p>
                ) : null}
                {plan.notes ? (
                  <p className="mb-2 text-xs text-[var(--color-muted)]">{plan.notes}</p>
                ) : null}
                {plan.calls.length > 0 ? (
                  <ul className="divide-y divide-[var(--color-border)]/70">
                    {plan.calls.map((call) => {
                      const name = call.doctor?.fullName ?? call.chemist?.name ?? '—';
                      const phone = call.doctor?.phone ?? call.chemist?.phone;
                      const sub = call.doctor
                        ? [call.doctor.specialization, call.doctor.city].filter(Boolean).join(' · ')
                        : (call.chemist?.city ?? '');
                      return (
                        <li key={call.id} className="flex items-center gap-3 py-2.5">
                          <span
                            className={
                              call.done
                                ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]'
                                : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-muted)]'
                            }
                          >
                            {call.done ? (
                              <CheckCircle2 size={15} />
                            ) : call.doctor ? (
                              <Stethoscope size={15} />
                            ) : (
                              <Store size={15} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={
                                call.done
                                  ? 'truncate text-sm font-semibold text-[var(--color-muted)] line-through'
                                  : 'truncate text-sm font-semibold text-[var(--color-ink)]'
                              }
                            >
                              {name}
                            </p>
                            {sub ? (
                              <p className="truncate text-[11px] text-[var(--color-muted)]">{sub}</p>
                            ) : null}
                          </div>
                          {phone ? (
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--color-ink)]"
                            >
                              <Phone size={12} className="text-[var(--color-muted)]" />
                              {phone}
                            </a>
                          ) : null}
                          {call.done ? <Badge tone="success">Done</Badge> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-2 text-xs text-[var(--color-muted)]">
                    No calls planned for today.
                  </p>
                )}
              </div>
            ) : (
              <EmptyState
                title="No approved plan for today"
                description="Draft and submit your monthly tour plan — once approved, today's beat and call list shows up here."
              />
            )}
          </Card>

          {/* ── Today's appointments ───────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Today's appointments"
              actions={
                <Link to="/appointments">
                  <Button size="sm" variant="ghost">
                    <CalendarCheck2 size={13} />
                    All appointments
                  </Button>
                </Link>
              }
            />
            {(day?.appointments.length ?? 0) > 0 ? (
              <ul className="divide-y divide-[var(--color-border)]/70 px-4">
                {day!.appointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-16 shrink-0 font-mono text-xs font-bold text-[var(--color-primary)]">
                      {formatTime12(appointment.time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                        {appointment.doctor?.fullName ?? '—'}
                      </p>
                      {appointment.purpose ? (
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {appointment.purpose}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={APPOINTMENT_TONE[appointment.status] ?? 'neutral'}>
                      {appointment.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No appointments today"
                description="Book one from the Appointments screen — completed ones file the visit / DCR."
              />
            )}
          </Card>

          {/* ── Pending follow-ups ─────────────────────────────────────────── */}
          {(day?.pendingFollowUps.length ?? 0) > 0 ? (
            <Card>
              <CardHeader
                title="Pending follow-ups"
                description="Visits whose follow-up date is due"
                actions={
                  <Link to="/visits">
                    <Button size="sm" variant="ghost">
                      <ClipboardList size={13} />
                      Visits
                    </Button>
                  </Link>
                }
              />
              <ul className="divide-y divide-[var(--color-border)]/70 px-4">
                {day!.pendingFollowUps.map((followUp) => (
                  <li key={followUp.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                        {followUp.doctor?.fullName ?? '—'}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        Visited {formatDisplayDate(followUp.visitDate)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-danger)]">
                      due {formatDisplayDate(followUp.nextFollowUp)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* ── Quick actions ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <Link to="/appointments" className="block">
              <Button variant="soft" fullWidth size="lg">
                <CalendarPlus size={15} />
                New appointment
              </Button>
            </Link>
            <Link to="/leave" className="block">
              <Button variant="secondary" fullWidth size="lg">
                <Plane size={15} />
                Apply leave
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
