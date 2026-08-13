import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)] shadow-[var(--shadow-sm)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg)] active:bg-[var(--color-bg)]',
  ghost:
    'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] active:bg-[var(--color-bg)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:brightness-95 active:brightness-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 min-h-8 px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  md: 'h-9 min-h-9 px-3.5 text-sm gap-1.5 rounded-[var(--radius-sm)] sm:h-9',
  lg: 'h-11 min-h-11 px-4 text-sm gap-2 rounded-[var(--radius-sm)]',
  icon: 'h-9 w-9 min-h-9 min-w-9 p-0 rounded-[var(--radius-sm)]',
  'icon-sm': 'h-8 w-8 min-h-8 min-w-8 p-0 rounded-[var(--radius-sm)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium tracking-tight whitespace-nowrap transition select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        'touch-manipulation',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Responsive action row — stacks full-width on mobile, inline on sm+. */
export function ButtonRow({
  children,
  className,
  align = 'end',
}: {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'between';
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center',
        align === 'end' && 'sm:justify-end',
        align === 'start' && 'sm:justify-start',
        align === 'between' && 'sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}
