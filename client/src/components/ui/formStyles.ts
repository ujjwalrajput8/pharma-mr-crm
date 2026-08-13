import { cn } from '@/utils/cn';

/** Shared form field label — sentence case, compact. */
export const fieldLabelClass =
  'text-xs font-medium text-[var(--color-muted)]';

/** Shared control surface used by Input, Select, Date/Time, SearchableSelect. */
export const fieldControlClass = cn(
  'h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
  'px-3 text-sm text-[var(--color-ink)] outline-none transition',
  'placeholder:text-[var(--color-muted)]/70',
  'hover:border-[var(--color-border-strong)]',
  'focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15',
  'disabled:cursor-not-allowed disabled:opacity-55',
);

export const fieldControlTriggerClass = cn(
  fieldControlClass,
  'inline-flex items-center justify-between text-left font-normal',
);
