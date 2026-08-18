import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { fieldControlTriggerClass, fieldLabelClass } from '@/components/ui/formStyles';

export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string | null;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option…',
  required,
  disabled,
  className,
  error,
}: SearchableSelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={rootRef} className={cn('group/field relative block', className)}>
      <div className={cn(fieldLabelClass, 'mb-1.5')}>
        <label htmlFor={id} className="flex items-center gap-1 cursor-pointer font-medium text-[var(--color-ink)]">
          <span>{label}</span>
          {required ? (
            <span className="text-[var(--color-danger)] text-sm leading-none font-bold" title="Required">
              *
            </span>
          ) : null}
        </label>
      </div>

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          fieldControlTriggerClass,
          open && 'border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/15 shadow-sm',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] ring-[var(--color-danger)]/15',
        )}
      >
        <span className={cn('truncate text-sm', !selected && 'text-[var(--color-muted)]/70')}>
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-[var(--color-ink)]">{selected.label}</span>
              {selected.meta ? (
                <span className="rounded-md bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--color-muted)]">
                  {selected.meta}
                </span>
              ) : null}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[var(--color-muted)]">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded-full p-1 hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
            >
              <X size={13} />
            </span>
          ) : null}
          <ChevronsUpDown size={15} className="text-[var(--color-muted)]" />
        </span>
      </button>

      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-danger)] font-medium animate-fade-in">{error}</p>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] backdrop-blur-md animate-scale-in">
          <div className="border-b border-[var(--color-border)] p-2 bg-[var(--color-surface-subtle)]/40">
            <div className="relative flex items-center">
              <Search size={14} className="pointer-events-none absolute left-3 text-[var(--color-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="h-8.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-8.5 pr-3 text-xs outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-[var(--color-muted)]">
                No matching options found
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-all duration-150',
                      'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
                      option.value === value
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold'
                        : 'text-[var(--color-ink)]',
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.meta ? (
                        <span className="mt-0.5 block truncate text-[11px] font-normal text-[var(--color-muted)]">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                    {option.value === value ? (
                      <Check size={15} className="shrink-0 text-[var(--color-primary)]" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

