import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'destructive';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:brightness-95',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)]',
  soft: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:brightness-95 border border-transparent',
  ghost:
    'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-white',
  destructive:
    'bg-[var(--color-danger)] text-white hover:brightness-95 active:brightness-90 border border-transparent',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 min-h-7 px-2.5 text-xs gap-1 rounded-md',
  md: 'h-8 min-h-8 px-3 text-xs gap-1.5 rounded-lg sm:text-sm',
  lg: 'h-9 min-h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  icon: 'h-8 w-8 min-h-8 min-w-8 p-0 rounded-lg',
  'icon-sm': 'h-7 w-7 min-h-7 min-w-7 p-0 rounded-md',
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)]',
        'disabled:pointer-events-none disabled:opacity-45',
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

/** Compact action row — wraps on small screens, never stretches buttons full-bleed unless fullWidth. */
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
        'flex flex-wrap items-center gap-1.5',
        align === 'end' && 'justify-end',
        align === 'start' && 'justify-start',
        align === 'between' && 'justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}
