import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && parseIsoDate(iso)) {
      onChange(iso);
      return;
    }
    setTyped(value);
  }

  return (
    <div ref={rootRef} className={cn('relative block', className)}>
      <label htmlFor={id} className={cn(fieldLabelClass, 'flex items-center gap-1')}>
        {label}
        {required ? <span className="text-[var(--color-danger)]">*</span> : null}
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
          className={cn(fieldControlClass, 'pr-9')}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[var(--color-muted)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open calendar"
        >
          <CalendarDays size={15} />
        </button>
      </div>
      {open ? (
        <div className="absolute z-50 mt-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-[var(--shadow-md)] animate-scale-in">
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
              <div className="mt-2 flex justify-between gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                  onClick={() => {
                    const iso = toIsoDate(new Date());
                    onChange(iso);
                    setTyped(iso);
                    setOpen(false);
                  }}
                >
                  Today
                </button>
                <span className="text-[var(--color-muted)]">
                  {selected ? format(selected, 'PPP') : 'Pick a day'}
                </span>
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
