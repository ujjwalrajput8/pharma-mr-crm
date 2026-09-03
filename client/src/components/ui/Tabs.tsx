import type { ComponentType } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  count?: number;
}

/** Pill tab bar — scrolls horizontally on phones instead of wrapping. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-hide flex w-full gap-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-xs sm:w-auto',
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
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150',
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-ink)]',
            )}
          >
            {Icon ? <Icon size={14} /> : null}
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span
                className={cn(
                  'ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
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
