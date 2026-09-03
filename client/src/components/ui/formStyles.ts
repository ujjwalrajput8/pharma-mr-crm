import { cn } from '@/utils/cn';

/**
 * Field styling. Inputs sit on the page background rather than the card surface
 * so they read as something you type into, and the focus ring is a single soft
 * halo instead of a hard outline — that is most of what separates a form that
 * feels current from one that feels like a 2015 admin panel.
 */

export const fieldLabelClass =
  'text-[11.5px] font-semibold tracking-[-0.005em] text-[var(--color-ink)]/75 select-none flex items-center justify-between';

export const fieldControlClass = cn(
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70',
  'px-3.5 text-[13px] text-[var(--color-ink)] outline-none transition-all duration-150',
  'placeholder:text-[var(--color-muted)]/55',
  'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg)]',
  'focus:border-[var(--color-primary)]/70 focus:bg-[var(--color-surface)] focus:ring-[3px] focus:ring-[var(--color-primary)]/12',
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-[var(--color-surface-subtle)]',
);

/** Select control with a custom chevron rendered by the Field component. */
export const fieldSelectClass = cn(fieldControlClass, 'appearance-none pr-10 cursor-pointer');

/** Trigger surface for custom popovers (DatePicker, TimePicker, SearchableSelect). */
export const fieldControlTriggerClass = cn(
  fieldControlClass,
  'inline-flex items-center justify-between text-left font-normal cursor-pointer',
);

/** Light panel used to group related fields without boxing them in. */
export const formSectionCardClass = cn(
  'rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-bg)]/40 p-4',
  'transition-colors duration-200',
);
