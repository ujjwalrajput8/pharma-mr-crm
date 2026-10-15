import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/services/attendance.service';
import type { DashboardSummary } from '@/services/dashboard.service';
import { useAuth } from '@/store/AuthContext';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Full-width welcome card: time-of-day greeting, today's date and two or three
 * live chips (today's schedule + check-in state) so the first glance answers
 * "what does today look like?".
 */
export function GreetingHero({ summary }: { summary?: DashboardSummary }) {
  const { user, can, role } = useAuth();
  const canCheckIn = can('attendance:own');

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
    enabled: canCheckIn,
    staleTime: 60_000,
  });

  const now = new Date();
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';
  const dateLine = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cards = summary?.cards;
  const checkInAt = attendanceQuery.data?.checkInAt ?? null;

  const chips: Array<{ key: string; label: string; dot: string }> = [];
  if (typeof cards?.todaysAppointments === 'number') {
    chips.push({
      key: 'appointments',
      label: `${cards.todaysAppointments.toLocaleString('en-IN')} appointment${cards.todaysAppointments === 1 ? '' : 's'} today`,
      dot: 'var(--color-primary)',
    });
  }
  if (typeof cards?.todaysVisits === 'number') {
    chips.push({
      key: 'visits',
      label: `${cards.todaysVisits.toLocaleString('en-IN')} visit${cards.todaysVisits === 1 ? '' : 's'} logged`,
      dot: 'var(--color-cal-visit)',
    });
  }
  if (canCheckIn && !attendanceQuery.isLoading) {
    chips.push(
      checkInAt
        ? {
            key: 'checkin',
            label: `Checked in at ${new Date(checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
            dot: 'var(--color-success)',
          }
        : { key: 'checkin', label: 'Not checked in yet', dot: 'var(--color-warning)' },
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[linear-gradient(120deg,var(--color-primary-soft)_0%,var(--color-surface)_58%)] shadow-xs">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">
            {greetingForHour(now.getHours())}, {firstName}
          </h2>
          <p className="mt-1 text-xs font-medium text-[var(--color-muted)] sm:text-sm">
            {dateLine}
            {role ? (
              <span className="ml-2 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--color-primary)] uppercase">
                {role === 'ADMIN' ? 'Organization' : role === 'MANAGER' ? 'Team' : 'Field'}
              </span>
            ) : null}
          </p>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {chips.slice(0, 3).map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-ink)] shadow-2xs backdrop-blur-sm"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: chip.dot }}
                />
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
