import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Gift,
  MapPinOff,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Page';
import {
  ACTIONABLE_KINDS,
  notificationsApi,
  type NotificationKind,
} from '@/services/notifications.service';
import { cn } from '@/utils/cn';

const ICON: Record<NotificationKind, typeof CalendarDays> = {
  LEAVE_PENDING: CalendarDays,
  LEAVE_DECIDED: CalendarCheck2,
  ATTENDANCE_FLAGGED: MapPinOff,
  ATTENDANCE_MISSING: UserX,
  APPOINTMENT_TODAY: CalendarCheck2,
  DOCTOR_OCCASION: Gift,
};

const TONE: Record<string, { chip: string; bar: string }> = {
  primary: { chip: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]', bar: 'var(--color-primary)' },
  success: { chip: 'bg-[var(--color-success-soft)] text-[var(--color-success)]', bar: 'var(--color-success)' },
  warning: { chip: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]', bar: 'var(--color-warning)' },
  danger: { chip: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]', bar: 'var(--color-danger)' },
  neutral: { chip: 'bg-[var(--color-bg)] text-[var(--color-muted)]', bar: 'var(--color-border-strong)' },
};

/**
 * Dashboard inbox. A leave request is useless if nobody sees it, so the first
 * thing on the dashboard is whatever is actually waiting on this person.
 * Renders nothing when the queue is empty rather than showing an empty box.
 */
export function NeedsAttention() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });

  const items = query.data?.items ?? [];
  if (items.length === 0) return null;

  const actionable = items.filter((item) => ACTIONABLE_KINDS.includes(item.kind));
  const shown = (actionable.length > 0 ? actionable : items).slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl',
              actionable.length > 0
                ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
            )}
          >
            <BellRing size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--color-ink)]">
              {actionable.length > 0 ? 'Needs your attention' : 'Worth a look today'}
            </h3>
            <p className="text-[11px] text-[var(--color-muted)]">
              {actionable.length > 0
                ? `${actionable.length} item${actionable.length > 1 ? 's' : ''} waiting on you`
                : 'Nothing blocking — just a heads-up'}
            </p>
          </div>
        </div>
        <Link to="/approvals">
          <Button size="sm" variant={actionable.length > 0 ? 'primary' : 'secondary'}>
            Open approvals
            <ChevronRight size={13} />
          </Button>
        </Link>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {shown.map((item) => {
          const Icon = ICON[item.kind] ?? BellRing;
          const tone = TONE[item.tone] ?? TONE.neutral!;
          return (
            <li key={item.id} className="relative">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: tone.bar }}
              />
              <button
                type="button"
                onClick={() => navigate(item.href)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 pl-5 text-left transition-colors hover:bg-[var(--color-bg)]/60"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    tone.chip,
                  )}
                >
                  <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-muted)]">
                    {item.message}
                  </span>
                </span>
                <ChevronRight
                  size={14}
                  className="mt-1 shrink-0 text-[var(--color-muted)]/60"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      {items.length > shown.length ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-2 text-center">
          <span className="text-[11px] font-medium text-[var(--color-muted)]">
            +{items.length - shown.length} more in the bell
          </span>
        </div>
      ) : null}
    </Card>
  );
}
