import { cn } from '@/utils/cn';

/** Shared form field label — clean, crisp modern typography */
export const fieldLabelClass =
  'text-xs font-semibold tracking-tight text-[var(--color-ink)]/90 select-none flex items-center justify-between';

/** Shared control surface used by Input, Select, Date/Time, SearchableSelect */
export const fieldControlClass = cn(
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
  'px-3.5 text-sm text-[var(--color-ink)] outline-none shadow-xs transition-all duration-200',
  'placeholder:text-[var(--color-muted)]/60',
  'hover:border-[var(--color-border-strong)] hover:shadow-sm',
  'focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:bg-[var(--color-surface)] focus:shadow-sm',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-bg)]',
);

/** Modern Select control with custom SVG chevron */
export const fieldSelectClass = cn(
  fieldControlClass,
  'appearance-none pr-10 cursor-pointer',
  'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]',
  'bg-no-repeat bg-[right_12px_center]',
);

/** Trigger surface for custom popovers (DatePicker, TimePicker, SearchableSelect) */
export const fieldControlTriggerClass = cn(
  fieldControlClass,
  'inline-flex items-center justify-between text-left font-normal cursor-pointer',
);

/** Form card section helper */
export const formSectionCardClass = cn(
  'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 shadow-xs backdrop-blur-xs',
  'transition-all duration-200 hover:border-[var(--color-border-strong)]',
);

