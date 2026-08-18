import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
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
    <div className="mb-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)] sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm font-normal">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
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
        'overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs transition-shadow duration-200',
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
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5 bg-[var(--color-bg)]/30">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-ink)]">{title}</h3>
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
  dot = true,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  dot?: boolean;
}) {
  const tones = {
    neutral: 'bg-[var(--color-bg)] text-[var(--color-muted)] border border-[var(--color-border-strong)]/60',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/25',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/25',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/25',
    primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-primary)]/25 font-bold',
  };

  const dotColors = {
    neutral: 'bg-[var(--color-muted)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]',
    primary: 'bg-[var(--color-primary)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase shadow-2xs',
        tones[tone],
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} /> : null}
      <span>{children}</span>
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <Info size={22} />
      </div>
      <p className="text-sm font-bold text-[var(--color-ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--color-muted)] leading-relaxed">{description}</p>
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
    danger: 'border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    warning: 'border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    success: 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]',
    primary: 'border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  };

  const icons = {
    danger: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle2,
    primary: Info,
  };

  const Icon = icons[tone];

  return (
    <div className={cn('flex items-center gap-2.5 rounded-[var(--radius-sm)] border px-4 py-3 text-sm shadow-2xs', tones[tone])}>
      <Icon size={16} className="shrink-0" />
      <span className="font-medium">{message}</span>
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
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition hover:shadow-sm">
      <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
}
