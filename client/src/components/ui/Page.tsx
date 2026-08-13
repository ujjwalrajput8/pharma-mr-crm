import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
}) {
  const tones = {
    neutral: 'bg-[var(--color-bg)] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/20',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]/20',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/20',
    primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

export function Alert({
  message,
  tone = 'danger',
}: {
  message: string;
  tone?: 'danger' | 'warning' | 'success' | 'primary';
}) {
  const tones = {
    danger: 'border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    warning: 'border-[var(--color-warning)]/25 bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    success: 'border-[var(--color-success)]/25 bg-[var(--color-success-soft)] text-[var(--color-success)]',
    primary: 'border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  };

  return (
    <div className={cn('rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm', tones[tone])}>
      {message}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
}
