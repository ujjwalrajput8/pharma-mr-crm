import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { fieldLabelClass } from '@/components/ui/formStyles';
import { cn } from '@/utils/cn';

/**
 * Small building blocks shared by every form, on top of Field / FormSection / Modal:
 * a responsive grid, chip choices and a quantity stepper (unsaved-changes guard:
 * hooks/useDiscardGuard).
 * Theme tokens only — no new colours.
 */

/** One column on phones, two from `sm` up. `full` children span both columns. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2', className)}>{children}</div>;
}

export function FormFull({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sm:col-span-2', className)}>{children}</div>;
}

/** Field label in the same style as Input / Select (for custom controls). */
export function FieldLabel({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <div className={cn(fieldLabelClass, 'mb-1.5')}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 font-medium text-[var(--color-ink)]">
        <span>{children}</span>
        {required ? (
          <span className="text-sm leading-none font-bold text-[var(--color-danger)]" title="Required">
            *
          </span>
        ) : null}
      </label>
    </div>
  );
}

/** Single choice as chips (radio group) — purpose, outcome, interest. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  size = 'md',
  allowClear = false,
  className,
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T | '' | null | undefined;
  onChange: (value: T | '') => void;
  required?: boolean;
  size?: 'sm' | 'md';
  allowClear?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active && allowClear ? '' : option.value)}
              className={cn(
                'rounded-full border font-semibold transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/20',
                size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs',
                active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)]/70 text-[var(--color-ink)]/80 hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** − / number / + — never below `min` or above `max`. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n);
  const button =
    'flex h-9 w-9 items-center justify-center text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="inline-flex h-9 items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70">
      <button type="button" aria-label={`Less ${label}`} className={button} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        className="h-9 w-12 border-x border-[var(--color-border)] bg-transparent text-center text-sm font-semibold tabular-nums text-[var(--color-ink)] outline-none"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          onChange(clamp(Number.isFinite(n) ? n : min));
        }}
      />
      <button type="button" aria-label={`More ${label}`} className={button} disabled={max != null && value >= max} onClick={() => onChange(clamp(value + 1))}>
        <Plus size={14} />
      </button>
    </div>
  );
}
