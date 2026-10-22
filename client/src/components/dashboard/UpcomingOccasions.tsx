import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, Cake, ChevronRight, Heart, Phone } from 'lucide-react';
import { Badge, Card } from '@/components/ui/Page';
import { dashboardApi, type Occasion, type OccasionKind } from '@/services/dashboard.service';
import { parseIsoDate } from '@/utils/datetime';
import { cn } from '@/utils/cn';

const OCCASION_META: Record<
  OccasionKind,
  { label: string; icon: typeof Cake; tone: 'primary' | 'danger' | 'success' }
> = {
  BIRTHDAY: { label: 'Birthday', icon: Cake, tone: 'primary' },
  ANNIVERSARY: { label: 'Anniversary', icon: Heart, tone: 'danger' },
  WORK_ANNIVERSARY: { label: 'Work anniversary', icon: BriefcaseBusiness, tone: 'success' },
};

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function whenText(daysAway: number): string {
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  return `In ${daysAway} days`;
}

/** "5th anniversary" / "3 years in the company" — birthdays deliberately show no age. */
function yearsText(item: Occasion): string | null {
  if (!item.years || item.kind === 'BIRTHDAY') return null;
  if (item.kind === 'WORK_ANNIVERSARY') {
    return `${item.years} year${item.years > 1 ? 's' : ''} in the company`;
  }
  return `${ordinal(item.years)} anniversary`;
}

/** One person + occasion. Shared by the dashboard card and the full list page. */
export function OccasionRow({ item }: { item: Occasion }) {
  const meta = OCCASION_META[item.kind];
  const Icon = meta.icon;
  const date = parseIsoDate(item.nextDate);
  const isToday = item.daysAway === 0;
  const details = [
    item.subtitle,
    item.personType === 'DOCTOR' ? 'Doctor' : 'Team',
    yearsText(item),
  ].filter(Boolean);

  return (
    <li className="relative flex items-center gap-3 px-4 py-3">
      {isToday ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-success)]"
        />
      ) : null}
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border leading-none',
          isToday
            ? 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]'
            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)]',
        )}
      >
        <span className="text-base font-bold tabular-nums">{date?.getDate() ?? '—'}</span>
        <span className="mt-0.5 text-[9px] font-bold tracking-wider uppercase">
          {date?.toLocaleDateString('en-IN', { month: 'short' }) ?? ''}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to={item.href}
          className="block truncate text-[13px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] hover:underline"
        >
          {item.name}
        </Link>
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">{details.join(' · ')}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={meta.tone} dot={false}>
          <span className="inline-flex items-center gap-1">
            <Icon size={11} />
            {meta.label}
          </span>
        </Badge>
        <span
          className={cn(
            'text-[11px] font-semibold',
            isToday ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]',
          )}
        >
          {whenText(item.daysAway)}
        </span>
      </div>

      {item.phone ? (
        <a
          href={`tel:${item.phone}`}
          aria-label={`Call ${item.name}`}
          title={`Call ${item.phone}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <Phone size={14} />
        </a>
      ) : (
        <span aria-hidden className="h-8 w-8 shrink-0" />
      )}
    </li>
  );
}

const DASHBOARD_LIMIT = 6;

/** Dashboard card — whoever has a birthday or anniversary in the next 7 days. */
export function UpcomingOccasions() {
  const query = useQuery({
    queryKey: ['occasions', 7],
    queryFn: () => dashboardApi.occasions({ days: 7 }),
  });

  const items = query.data?.items ?? [];
  const todayCount = items.filter((item) => item.daysAway === 0).length;
  const shown = items.slice(0, DASHBOARD_LIMIT);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Cake size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-ink)]">
              Birthdays & anniversaries
            </h3>
            <p className="text-[11px] text-[var(--color-muted)]">
              {todayCount > 0
                ? `${todayCount} today — wish them now`
                : 'Coming up in the next 7 days'}
            </p>
          </div>
        </div>
        <Link
          to="/occasions"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          View all
          <ChevronRight size={13} />
        </Link>
      </div>

      {query.isLoading ? (
        <p className="px-4 py-6 text-center text-xs text-[var(--color-muted)]">Loading…</p>
      ) : query.isError ? (
        <p className="px-4 py-6 text-center text-xs text-[var(--color-danger)]">
          Could not load upcoming occasions.
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-[var(--color-muted)]">
          No birthdays or anniversaries in the next 7 days.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {shown.map((item) => (
            <OccasionRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {items.length > shown.length ? (
        <Link
          to="/occasions"
          className="block border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-2 text-center text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          +{items.length - shown.length} more this week
        </Link>
      ) : null}
    </Card>
  );
}
