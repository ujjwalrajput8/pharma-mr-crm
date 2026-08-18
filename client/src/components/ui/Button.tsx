import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'destructive' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white shadow-xs hover:bg-[var(--color-primary-hover)] hover:shadow-sm active:scale-[0.98] border border-transparent',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] shadow-xs hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] active:scale-[0.98]',
  soft: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98] border border-transparent font-semibold',
  ghost:
    'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] active:scale-[0.98]',
  outline:
    'bg-transparent text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg)] active:scale-[0.98]',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)] hover:text-white active:scale-[0.98]',
  destructive:
    'bg-[var(--color-danger)] text-white shadow-xs hover:brightness-95 active:scale-[0.98] border border-transparent',
};

const sizes: Record<Size, string> = {
  sm: 'h-7.5 min-h-[30px] px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)] font-medium',
  md: 'h-9 min-h-[36px] px-3.5 text-xs sm:text-sm gap-2 rounded-[var(--radius-sm)] font-medium',
  lg: 'h-10.5 min-h-[42px] px-4.5 text-sm gap-2 rounded-[var(--radius-sm)] font-semibold',
  icon: 'h-9 w-9 min-h-[36px] min-w-[36px] p-0 rounded-[var(--radius-sm)]',
  'icon-sm': 'h-7.5 w-7.5 min-h-[30px] min-w-[30px] p-0 rounded-[var(--radius-sm)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium tracking-tight whitespace-nowrap cursor-pointer transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
        'disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed',
        'touch-manipulation',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
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
        'flex flex-wrap items-center gap-2',
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
