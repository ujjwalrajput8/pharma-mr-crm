import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { currentMonthKey, monthLabel, shiftMonth } from '@/utils/month';

export interface MonthCalendarCell {
  /** `YYYY-MM-DD` */
  date: string;
  /** Short label inside the cell, e.g. "Present" or the holiday name. */
  label?: string | null;
  /** Secondary line, e.g. "8.2 h". */
  meta?: string | null;
  /** Accent colour — a CSS colour or `var(--token)`. */
  color?: string | null;
  /** Renders the cell dimmed (weekly off, holiday, future). */
  muted?: boolean;
  /** Small warning triangle in the corner. */
  flagged?: boolean;
  disabled?: boolean;
  title?: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthCalendarProps {
  /** `YYYY-MM` */
  month: string;
  cells: MonthCalendarCell[];
  onMonthChange?: (month: string) => void;
  onSelect?: (cell: MonthCalendarCell) => void;
  legend?: Array<{ label: string; color: string }>;
  toolbar?: ReactNode;
  loading?: boolean;
  /** Hide the internal header when the page already renders one. */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Month grid used by the attendance register and the holiday calendar.
 * Cells are driven entirely by `cells`, so the same component renders a
 * per-employee register, a leave calendar or a holiday list.
 */
export function MonthCalendar({
  month,
  cells,
  onMonthChange,
  onSelect,
  legend,
  toolbar,
  loading,
  hideHeader,
  className,
}: MonthCalendarProps) {
  const byDate = useMemo(() => new Map(cells.map((cell) => [cell.date, cell])), [cells]);
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
  }, []);

  const grid = useMemo(() => {
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon) return [];
    const first = new Date(year, mon - 1, 1);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const leadingBlanks = first.getDay();

    const slots: Array<{ key: string; date?: string; dayNumber?: number }> = [];
    for (let i = 0; i < leadingBlanks; i += 1) slots.push({ key: `blank-${i}` });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      slots.push({ key: date, date, dayNumber: day });
    }
    // Pad to a whole number of weeks so the grid never has a ragged last row.
    while (slots.length % 7 !== 0) slots.push({ key: `tail-${slots.length}` });
    return slots;
  }, [month]);

  return (
    <div className={cn('w-full', className)}>
      {!hideHeader ? (
        <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {onMonthChange ? (
              <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => onMonthChange(shiftMonth(month, -1))}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onMonthChange(currentMonthKey())}
                  className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-bold tracking-wide text-[var(--color-muted)] uppercase transition hover:text-[var(--color-primary)]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => onMonthChange(shiftMonth(month, 1))}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:scale-95"
                  aria-label="Next month"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            ) : null}
            <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-[var(--color-ink)]">
              {monthLabel(month)}
              {loading ? (
                <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" />
              ) : null}
            </h3>
          </div>
          {toolbar}
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'pb-1.5 text-center text-[10px] font-bold tracking-wider uppercase',
              index === 0 ? 'text-[var(--color-danger)]/70' : 'text-[var(--color-muted)]',
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.slice(0, 1)}</span>
          </div>
        ))}

        {grid.map((slot) => {
          if (!slot.date) {
            return <div key={slot.key} className="min-h-[62px] rounded-[var(--radius-sm)]" />;
          }
          const cell = byDate.get(slot.date);
          const isToday = slot.date === todayKey;
          const clickable = Boolean(onSelect) && !cell?.disabled;

          return (
            <button
              key={slot.key}
              type="button"
              disabled={!clickable}
              title={cell?.title}
              onClick={() => (cell ? onSelect?.(cell) : undefined)}
              className={cn(
                'group relative flex min-h-[62px] flex-col items-start gap-0.5 overflow-hidden rounded-[var(--radius-sm)] border p-1.5 text-left transition-all duration-150 sm:min-h-[78px] sm:p-2',
                'border-[var(--color-border)] bg-[var(--color-surface)]',
                cell?.muted && 'bg-[var(--color-bg)]',
                clickable
                  ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-primary)]/50 hover:shadow-sm'
                  : 'cursor-default',
                isToday && 'ring-2 ring-[var(--color-primary)]/45 ring-offset-1 ring-offset-[var(--color-surface)]',
              )}
            >
              {/* Left accent bar carries the status colour. */}
              {cell?.color ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-sm)]"
                  style={{ background: cell.color }}
                />
              ) : null}

              <div className="flex w-full items-center justify-between gap-1">
                <span
                  className={cn(
                    'text-[11px] font-bold tabular-nums sm:text-xs',
                    isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink)]',
                    cell?.muted && !isToday && 'text-[var(--color-muted)]',
                  )}
                >
                  {slot.dayNumber}
                </span>
                {cell?.flagged ? (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning)]"
                  />
                ) : null}
              </div>

              {cell?.label ? (
                <span
                  className="line-clamp-2 text-[10px] leading-tight font-semibold sm:text-[11px]"
                  style={{ color: cell.color ?? 'var(--color-muted)' }}
                >
                  {cell.label}
                </span>
              ) : null}
              {cell?.meta ? (
                <span className="mt-auto font-mono text-[9px] text-[var(--color-muted)] sm:text-[10px]">
                  {cell.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {legend && legend.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--color-border)] pt-3">
          {legend.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-muted)]"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
