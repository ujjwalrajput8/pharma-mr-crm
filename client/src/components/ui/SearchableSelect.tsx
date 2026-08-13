import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  required,
  disabled,
  className,
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
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={rootRef} className={cn('relative block', className)}>
      <label htmlFor={id} className={cn(fieldLabelClass, 'flex items-center gap-1')}>
        {label}
        {required ? <span className="text-[var(--color-danger)]">*</span> : null}
      </label>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(fieldControlTriggerClass, 'mt-1.5')}
      >
        <span className={cn('truncate', !selected && 'text-[var(--color-muted)]')}>
          {selected ? (
            <>
              {selected.label}
              {selected.meta ? (
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">{selected.meta}</span>
              ) : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[var(--color-muted)]">
          {value ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded p-0.5 hover:bg-black/5"
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
          <ChevronsUpDown size={14} />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] animate-scale-in">
          <div className="border-b border-[var(--color-border)] p-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-5 text-center text-xs text-[var(--color-muted)]">No results</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[var(--color-primary-soft)]',
                      option.value === value && 'bg-[var(--color-primary-soft)]',
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
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--color-muted)]">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                    {option.value === value ? (
                      <Check size={14} className="shrink-0 text-[var(--color-primary)]" />
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
