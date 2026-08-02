import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatTime12, parseTime12To24 } from '@/utils/datetime';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (hhmm24: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

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
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return { hour12: '10', minute: '00', period: 'AM' as const };
    let h = Number(match[1]);
    const minute = match[2]!;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return { hour12: String(h).padStart(2, '0'), minute, period: period as 'AM' | 'PM' };
  }, [value]);

  function apply(hour12: string, minute: string, period: 'AM' | 'PM') {
    const parsed = parseTime12To24(`${hour12}:${minute} ${period}`);
    if (parsed) onChange(parsed);
  }

  function commitTyped(raw: string) {
    const parsed = parseTime12To24(raw);
    if (parsed) {
      onChange(parsed);
      setTyped(formatTime12(parsed));
      return;
    }
    setTyped(display);
  }

  return (
    <div ref={rootRef} className={cn('relative block text-sm font-medium text-[var(--color-ink)]', className)}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
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
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-muted)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open time picker"
        >
          <Clock size={16} />
        </button>
      </div>
      {open ? (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-md)] animate-scale-in">
          <div className="grid grid-cols-3 gap-2">
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={cn(
                    'block w-full px-2 py-1.5 text-left text-sm hover:bg-[var(--color-primary-soft)]',
                    parts.hour12 === h && 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]',
                  )}
                  onClick={() => apply(h, parts.minute, parts.period)}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    'block w-full px-2 py-1.5 text-left text-sm hover:bg-[var(--color-primary-soft)]',
                    parts.minute === m && 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]',
                  )}
                  onClick={() => apply(parts.hour12, m, parts.period)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    'block w-full rounded-xl border border-[var(--color-border)] px-2 py-2 text-sm hover:bg-[var(--color-primary-soft)]',
                    parts.period === p && 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]',
                  )}
                  onClick={() => apply(parts.hour12, parts.minute, p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--color-primary)] px-2 py-2 text-sm text-white"
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
