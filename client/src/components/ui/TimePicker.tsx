import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatTime12, parseTime12To24 } from '@/utils/datetime';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/formStyles';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (hhmm24: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const PRESETS = ['09:00', '10:00', '11:30', '14:00', '16:30', '18:00'];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

export function TimePicker({
  label,
  value,
  onChange,
  required,
  disabled,
  className,
}: TimePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const display = useMemo(() => (value ? formatTime12(value) : ''), [value]);
  const [typed, setTyped] = useState(display);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTyped(display);
  }, [display]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const parts = useMemo(() => {
    const formatted = formatTime12(value || '10:00');
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(formatted);
    return {
      hour12: match?.[1]?.padStart(2, '0') ?? '10',
      minute: match?.[2] ?? '00',
      period: (match?.[3]?.toUpperCase() as 'AM' | 'PM') ?? 'AM',
    };
  }, [value]);

  function apply(hour12: string, minute: string, period: 'AM' | 'PM') {
    const parsed = parseTime12To24(`${hour12}:${minute} ${period}`);
    if (parsed) onChange(parsed);
  }

  function commitTyped(raw: string) {
    if (!raw.trim()) {
      onChange('');
      return;
    }
    const parsed = parseTime12To24(raw);
    if (parsed) {
      onChange(parsed);
      setTyped(formatTime12(parsed));
      return;
    }
    setTyped(display);
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
          placeholder="hh:mm AM/PM"
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
              aria-label="Clear time"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            className="p-1 rounded-md hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open time picker"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="absolute left-0 sm:left-auto right-0 z-50 mt-1.5 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lg)] animate-scale-in">
          {/* Quick presets */}
          <div className="mb-2.5 flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2.5">
            {PRESETS.map((p) => {
              const label12 = formatTime12(p);
              const isActive = value === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold transition',
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)]',
                  )}
                >
                  {label12}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">
              <span className="block px-2 py-0.5 text-[10px] font-bold text-[var(--color-muted)] uppercase">Hour</span>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={cn(
                    'block w-full rounded-lg px-2 py-1.5 text-center text-xs transition',
                    parts.hour12 === h
                      ? 'bg-[var(--color-primary)] font-bold text-white shadow-xs'
                      : 'hover:bg-[var(--color-primary-soft)] text-[var(--color-ink)]',
                  )}
                  onClick={() => apply(h, parts.minute, parts.period)}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">
              <span className="block px-2 py-0.5 text-[10px] font-bold text-[var(--color-muted)] uppercase">Min</span>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    'block w-full rounded-lg px-2 py-1.5 text-center text-xs transition',
                    parts.minute === m
                      ? 'bg-[var(--color-primary)] font-bold text-white shadow-xs'
                      : 'hover:bg-[var(--color-primary-soft)] text-[var(--color-ink)]',
                  )}
                  onClick={() => apply(parts.hour12, m, parts.period)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex flex-col justify-between gap-1.5">
              <div className="space-y-1">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cn(
                      'block w-full rounded-xl border border-[var(--color-border)] py-2 text-center text-xs font-bold transition',
                      parts.period === p
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30'
                        : 'hover:bg-[var(--color-bg)] text-[var(--color-ink)]',
                    )}
                    onClick={() => apply(parts.hour12, parts.minute, p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--color-primary)] py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition cursor-pointer"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
