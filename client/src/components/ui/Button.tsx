import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'destructive' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

/**
 * Compact, calm buttons. The primary action carries a soft vertical gradient so
 * it reads as the one thing to click without shouting; everything else stays
 * quiet so a screen full of actions doesn't feel heavy.
 */
const variants: Record<Variant, string> = {
  primary: cn(
    'text-white border border-[var(--color-primary-hover)]/40',
    'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_92%,white)_0%,var(--color-primary)_100%)]',
    'shadow-[0_1px_2px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.18)]',
    'hover:bg-[var(--color-primary-hover)] hover:shadow-[0_2px_8px_var(--color-primary-glow)]',
    'active:scale-[0.985]',
  ),
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] shadow-2xs hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] active:scale-[0.985]',
  soft: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white hover:border-transparent active:scale-[0.985] font-semibold',
  ghost:
    'bg-transparent text-[var(--color-muted)] border border-transparent hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] active:scale-[0.985]',
  outline:
    'bg-transparent text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg)] hover:border-[var(--color-primary)]/50 active:scale-[0.985]',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-white hover:border-transparent active:scale-[0.985]',
  destructive: cn(
    'text-white border border-transparent',
    'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-danger)_92%,white)_0%,var(--color-danger)_100%)]',
    'shadow-[0_1px_2px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.18)]',
    'hover:brightness-[0.97] active:scale-[0.985]',
  ),
};

const sizes: Record<Size, string> = {
  sm: 'h-7 min-h-[28px] px-2.5 text-[11.5px] gap-1.5 rounded-lg font-semibold',
  md: 'h-8.5 min-h-[34px] px-3 text-xs gap-1.5 rounded-[10px] font-semibold',
  lg: 'h-10 min-h-[40px] px-4 text-[13px] gap-2 rounded-xl font-semibold',
  icon: 'h-8.5 w-8.5 min-h-[34px] min-w-[34px] p-0 rounded-[10px]',
  'icon-sm': 'h-7 w-7 min-h-[28px] min-w-[28px] p-0 rounded-lg',
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
        'inline-flex shrink-0 items-center justify-center tracking-[-0.01em] whitespace-nowrap cursor-pointer select-none',
        'transition-[background,color,box-shadow,transform,border-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)]',
        'disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none',
        'touch-manipulation [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Compact action row — wraps on small screens, never stretches buttons full-bleed. */
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
