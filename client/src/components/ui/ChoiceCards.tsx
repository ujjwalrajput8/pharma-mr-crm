import type { ComponentType } from 'react';
import { Check } from 'lucide-react';
import { fieldLabelClass } from '@/components/ui/formStyles';
import { cn } from '@/utils/cn';

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Radio group rendered as selectable tiles.
 *
 * For a decision that shapes the rest of a form — "is this an MR or a Manager?" —
 * a dropdown hides the consequence behind a click. Tiles show both options with
 * their meaning, which is the difference between a form a non-technical user
 * guesses at and one they understand.
 */
export function ChoiceCards<T extends string | number>({
  label,
  hint,
  required,
  value,
  choices,
  onChange,
  columns = 2,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  value: T;
  choices: Array<Choice<T>>;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div className={cn('block', className)}>
      {label ? (
        <div className={cn(fieldLabelClass, 'mb-1.5')}>
          <span className="flex items-center gap-1">
            {label}
            {required ? (
              <span className="text-sm leading-none font-bold text-[var(--color-danger)]">*</span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          'grid gap-2',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {choices.map((choice) => {
          const selected = choice.value === value;
          const Icon = choice.icon;
          return (
            <button
              key={String(choice.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(choice.value)}
              className={cn(
                'group relative flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/20',
                selected
                  ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary-soft)] shadow-[0_1px_3px_var(--color-primary-glow)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)]/60 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg)]',
              )}
            >
              {Icon ? (
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                    selected
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-muted)] group-hover:text-[var(--color-ink)]',
                  )}
                >
                  <Icon size={15} />
                </span>
              ) : null}

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[13px] leading-tight font-bold',
                    selected ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]',
                  )}
                >
                  {choice.label}
                </span>
                {choice.description ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-muted)]">
                    {choice.description}
                  </span>
                ) : null}
              </span>

              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all',
                  selected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
                )}
              >
                {selected ? <Check size={10} strokeWidth={3.5} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {hint ? (
        <p className="mt-1.5 text-[11px] leading-normal text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
