import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock3,
  PartyPopper,
  UserX,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState, StatTile } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { ATTENDANCE_STATUS_META, attendanceApi } from '@/services/attendance.service';
import { HOLIDAY_TYPE_LABEL, type HolidayType } from '@/services/holidays.service';
import { leavesApi } from '@/services/leaves.service';
import { formatDisplayDate } from '@/utils/datetime';
import { monthLabel } from '@/utils/month';
import type { AttendanceLeaveTab } from '@/pages/AttendanceLeavePage';

/**
 * Attendance & Leave → Overview. One server call, already scoped by role:
 * an MR sees themselves, a manager their reporting line, Admin the company.
 */
export function OverviewTab({
  onNavigate,
  onApplyLeave,
}: {
  onNavigate: (tab: AttendanceLeaveTab) => void;
  onApplyLeave: () => void;
}) {
  const { can } = useAuth();
  const overviewQuery = useQuery({ queryKey: ['attendance', 'overview'], queryFn: () => attendanceApi.overview() });
  const todayQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
    enabled: can('attendance:own'),
  });
  const balancesQuery = useQuery({
    queryKey: ['leave-balances', 'me'],
    queryFn: () => leavesApi.balances(),
    enabled: can('leaves:own'),
  });

  const data = overviewQuery.data;
  if (overviewQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <BrandLoader label="Loading overview" />
      </div>
    );
  }
  if (!data) {
    return <EmptyState title="Overview unavailable" description="Could not load the attendance overview — try again." />;
  }

  const isSelf = data.scope === 'SELF';
  const canApprove = can('leaves:manage') || can('attendance:manage');
  const canApply = can('leaves:own') || can('leaves:manage');
  const mine = todayQuery.data;
  const balances = (balancesQuery.data?.balances ?? []).filter((balance) => !balance.unlimited);
  const pendingTotal = data.pending.leaves + data.pending.regularizations + data.pending.flagged;

  return (
    <div className="space-y-5" data-testid="overview-tab">
      {/* ── Today ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`Today · ${formatDisplayDate(data.date)}`}
          description={
            !data.workingDay
              ? `${data.holidayName ?? 'Sunday — weekly off'}. No attendance is expected today.`
              : isSelf
                ? 'Your attendance for today.'
                : `${data.members} people in ${data.scope === 'COMPANY' ? 'the company' : 'your team'}.`
          }
          actions={
            canApply ? (
              <Button size="sm" onClick={onApplyLeave}>
                <CalendarPlus size={14} />
                Apply leave
              </Button>
            ) : null
          }
        />
        {isSelf ? (
          <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
            {mine?.status ? (
              <Badge tone={ATTENDANCE_STATUS_META[mine.status].tone}>{ATTENDANCE_STATUS_META[mine.status].label}</Badge>
            ) : (
              <Badge tone={data.workingDay ? 'warning' : 'neutral'}>{data.workingDay ? 'Not checked in' : 'Off today'}</Badge>
            )}
            <span className="text-xs text-[var(--color-muted)]">
              {mine?.checkInAt
                ? `In ${new Date(mine.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${
                    mine.checkOutAt
                      ? ` · Out ${new Date(mine.checkOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                      : ''
                  }`
                : data.workingDay
                  ? 'Check in from My Attendance.'
                  : ''}
            </span>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('attendance')}>
              <Clock3 size={14} />
              My Attendance
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4 lg:grid-cols-7">
            <StatTile label="Present" value={data.today.present + data.today.office + data.today.jointWork} icon={CheckCircle2} tone="success" />
            <StatTile label="Late" value={data.today.late} icon={Clock3} tone="warning" />
            <StatTile label="Absent" value={data.today.absent} icon={UserX} tone="danger" />
            <StatTile label="On leave" value={data.today.onLeave} icon={CalendarCheck2} tone="primary" />
            <StatTile label="Half-day" value={data.today.halfDay} icon={CalendarRange} />
            <StatTile label="Not marked" value={data.today.notMarked} icon={Users} tone={data.today.notMarked ? 'warning' : 'neutral'} />
            <StatTile label="Flagged" value={data.today.flagged} icon={AlertTriangle} tone={data.today.flagged ? 'warning' : 'neutral'} />
          </div>
        )}
        {!isSelf && data.notCheckedIn.length > 0 ? (
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
              Not checked in yet
            </p>
            <ul className="flex flex-wrap gap-2" data-testid="not-checked-in">
              {data.notCheckedIn.map((person) => (
                <li
                  key={person.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] py-1 pr-3 pl-1 text-xs"
                >
                  <Avatar name={person.fullName} userId={person.id} size="sm" />
                  {person.fullName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* ── This month + pending ─────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${monthLabel(data.month.month)} so far`}
            description={isSelf ? 'Your days this month.' : 'Days marked across the team this month.'}
          />
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-5">
            <StatTile label="Present" value={data.month.present + data.month.office + data.month.jointWork} tone="success" />
            <StatTile label="Late" value={data.month.late} tone="warning" />
            <StatTile label="Absent" value={data.month.absent} tone="danger" />
            <StatTile label="Leave" value={data.month.leave} tone="primary" />
            <StatTile
              label="Attendance"
              value={data.month.attendanceRate === null ? '—' : `${data.month.attendanceRate}%`}
              hint="Worked ÷ marked days"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={isSelf ? 'My pending requests' : 'Waiting for you'}
            description={pendingTotal ? `${pendingTotal} to look at` : 'All clear'}
          />
          <ul className="space-y-2 px-4 pb-4 text-sm">
            <PendingRow icon={CalendarRange} label="Leave requests" count={data.pending.leaves} />
            <PendingRow icon={CalendarClock} label="Regularizations" count={data.pending.regularizations} />
            {!isSelf ? <PendingRow icon={AlertTriangle} label="Flagged check-ins" count={data.pending.flagged} /> : null}
          </ul>
          <div className="px-4 pb-4">
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => onNavigate(canApprove ? 'approvals' : 'leave')}
            >
              {canApprove ? 'Open Approvals' : 'Open my leave'}
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Balances · on leave · holidays ───────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {balances.length > 0 ? (
          <Card>
            <CardHeader title="My leave balance" description={`${balancesQuery.data?.year ?? ''} calendar year`} />
            <ul className="space-y-2 px-4 pb-4">
              {balances.map((balance) => (
                <li key={balance.leaveTypeId} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: balance.colorHex }} aria-hidden />
                    {balance.code} <span className="text-xs text-[var(--color-muted)]">{balance.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {balance.remaining}
                    <span className="text-xs font-normal text-[var(--color-muted)]"> / {balance.entitled}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {!isSelf ? (
          <Card>
            <CardHeader title="On leave this week" description="Approved leave, today to next 6 days" />
            {data.onLeave.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-[var(--color-muted)]">Nobody is on leave this week.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {data.onLeave.map((row) => (
                  <li key={`${row.userId}-${row.fromDate}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Avatar name={row.fullName} userId={row.userId} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.fullName}</p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        {row.leaveType} · {formatDisplayDate(row.fromDate)}
                        {row.toDate !== row.fromDate ? ` → ${formatDisplayDate(row.toDate)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Upcoming holidays"
            actions={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('holidays')}>
                Calendar
              </Button>
            }
          />
          {data.upcomingHolidays.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-[var(--color-muted)]">No holidays in the next six months.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {data.upcomingHolidays.map((holiday) => (
                <li key={`${holiday.date}-${holiday.name}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <PartyPopper size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{holiday.name}</p>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {formatDisplayDate(holiday.date)} · {HOLIDAY_TYPE_LABEL[holiday.type as HolidayType] ?? holiday.type}
                      {holiday.isOptional ? ' · optional' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function PendingRow({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof CalendarRange;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[var(--color-ink)]">
        <Icon size={14} className="text-[var(--color-muted)]" />
        {label}
      </span>
      <Badge tone={count > 0 ? 'warning' : 'neutral'}>{count}</Badge>
    </li>
  );
}
