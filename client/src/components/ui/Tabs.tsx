import { useEffect, useRef, type ComponentType, type KeyboardEvent } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  count?: number;
}

/**
 * Tab bar in two weights:
 * - `segment` (default) — the pill group, same look as the calendar's Month / Week /
 *   Day switch. For subtabs and filters inside a page.
 * - `page` — main tabs of a page: larger, icon + label + count, underline on the
 *   active tab. One page, one row of these.
 * Both: ← → / Home / End move between tabs; phones scroll sideways and keep the
 * active tab in view.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  variant = 'segment',
  ariaLabel,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: 'segment' | 'page';
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const isPage = variant === 'page';

  // Keep the active tab visible when the bar scrolls (phones).
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.value === value);
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      data-variant={variant}
      className={cn(
        'scrollbar-hide flex w-full overflow-x-auto',
        isPage
          ? 'snap-x gap-1 border-b border-[var(--color-border)]'
          : 'gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-xs sm:w-auto',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/25',
              isPage
                ? cn(
                    'relative -mb-px min-h-11 snap-start gap-2 rounded-t-[var(--radius-sm)] px-4 text-sm font-semibold',
                    'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
                    active
                      ? 'bg-[var(--color-primary-soft)]/60 text-[var(--color-primary)] after:bg-[var(--color-primary)]'
                      : 'text-[var(--color-muted)] after:bg-transparent hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]',
                  )
                : cn(
                    'gap-1.5 rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-xs font-semibold',
                    active
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-ink)]',
                  ),
            )}
          >
            {Icon ? <Icon size={isPage ? 16 : 14} /> : null}
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span
                className={cn(
                  'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px font-bold tabular-nums',
                  isPage ? 'text-[11px]' : 'ml-0.5 text-[10px]',
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-border)] text-[var(--color-ink)]',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
