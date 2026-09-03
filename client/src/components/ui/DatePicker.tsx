import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, X } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/utils/cn';
import { parseIsoDate, toIsoDate } from '@/utils/datetime';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/formStyles';
import 'react-day-picker/style.css';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  placeholder = 'Select date',
}: DatePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => parseIsoDate(value), [value]);

  useEffect(() => {
    setTyped(value);
  }, [value]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function commitTyped(raw: string) {
    const iso = raw.trim();
    if (!iso) {
      onChange('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && parseIsoDate(iso)) {
      onChange(iso);
      return;
    }
    setTyped(value);
  }

  function handleSelectPreset(offsetDays: number) {
    const targetDate = addDays(new Date(), offsetDays);
    const iso = toIsoDate(targetDate);
    onChange(iso);
    setTyped(iso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn('relative block', className)}>
      <label htmlFor={id} className={cn(fieldLabelClass, 'flex items-center gap-1')}>
        {label}
        {required ? <span className="text-[var(--color-danger)] font-bold">*</span> : null}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          disabled={disabled}
          required={required}
          value={typed}
          placeholder={placeholder}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => commitTyped(typed)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped(typed);
              setOpen(false);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className={cn(fieldControlClass, 'pr-16')}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 px-2 text-[var(--color-muted)]">
          {typed ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setTyped('');
              }}
              className="p-1 rounded-full hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] transition-colors"
              aria-label="Clear date"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            className="p-1 rounded-md hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open calendar"
          >
            <CalendarDays size={16} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="absolute left-0 sm:left-auto right-0 z-50 mt-1.5 w-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lg)] animate-scale-in">
          {/* Quick preset chips */}
          <div className="mb-2 flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2.5">
            <button
              type="button"
              className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white"
              onClick={() => handleSelectPreset(0)}
            >
              Today
            </button>
            <button
              type="button"
              className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] border border-[var(--color-border)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              onClick={() => handleSelectPreset(1)}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] border border-[var(--color-border)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              onClick={() => handleSelectPreset(7)}
            >
              +1 Week
            </button>
          </div>

          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              const iso = toIsoDate(date);
              onChange(iso);
              setTyped(iso);
              setOpen(false);
            }}
            footer={
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
                <span className="text-[var(--color-muted)] font-medium">
                  {selected ? format(selected, 'EEEE, MMM d, yyyy') : 'No date selected'}
                </span>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
