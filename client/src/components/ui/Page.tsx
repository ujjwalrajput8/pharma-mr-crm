import type { ComponentType, ReactNode } from 'react';
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

const statTones = {
  neutral: { ring: 'var(--color-border-strong)', ink: 'var(--color-ink)' },
  primary: { ring: 'var(--color-primary)', ink: 'var(--color-primary)' },
  success: { ring: 'var(--color-success)', ink: 'var(--color-success)' },
  warning: { ring: 'var(--color-warning)', ink: 'var(--color-warning)' },
  danger: { ring: 'var(--color-danger)', ink: 'var(--color-danger)' },
} as const;

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  footer,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  tone?: keyof typeof statTones;
  footer?: ReactNode;
  onClick?: () => void;
}) {
  const palette = statTones[tone];
  const interactive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'relative overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs transition-all duration-200',
        interactive
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30'
          : 'hover:shadow-sm',
      )}
    >
      {/* Tone accent along the top edge. */}
      {tone !== 'neutral' ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: palette.ring }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
          {label}
        </p>
        {Icon ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in srgb, ${palette.ring} 12%, transparent)`,
              color: palette.ink,
            }}
          >
            <Icon size={14} />
          </span>
        ) : null}
      </div>
      <p
        className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums"
        style={{ color: tone === 'neutral' ? 'var(--color-ink)' : palette.ink }}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p> : null}
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </div>
  );
}

/** Label / value pair used across detail panels. */
export function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)]/70 py-2 last:border-0">
      <dt className="shrink-0 text-xs font-medium text-[var(--color-muted)]">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-xs font-semibold break-words',
          mono && 'font-mono',
          empty ? 'text-[var(--color-muted)]/60' : 'text-[var(--color-ink)]',
        )}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

/** Titled panel for detail sections (profile, policy blocks). */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Icon size={14} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold tracking-wider text-[var(--color-ink)] uppercase">
              {title}
            </h4>
            {description ? (
              <p className="truncate text-[11px] text-[var(--color-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {actions}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
