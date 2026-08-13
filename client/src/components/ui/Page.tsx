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
    <div className="mb-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      {children}
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
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  };

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

export function Alert({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  );
}
