import { useEffect, type ComponentType, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, ButtonRow } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Widen for record detail views. */
  width?: 'md' | 'lg' | 'xl';
  className?: string;
}

const widths = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-3xl',
};

/**
 * Right-hand side sheet for record detail (employee profile, day detail).
 * Slides in on desktop, becomes a bottom sheet on phones.
 */
export function Drawer({
  open,
  title,
  subtitle,
  icon: Icon,
  badge,
  onClose,
  children,
  footer,
  width = 'lg',
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close panel backdrop"
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-scale-in',
          'sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-3xl sm:border-y-0 sm:border-r-0',
          widths[width],
          className,
        )}
      >
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[var(--color-primary)] via-teal-400 to-[var(--color-primary)]" />

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3.5">
            {Icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-xs">
                <Icon size={20} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-bold tracking-tight text-[var(--color-ink)]">
                  {title}
                </h3>
                {badge}
              </div>
              {subtitle ? (
                <p className="mt-0.5 truncate text-xs text-[var(--color-muted)] sm:text-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full text-[var(--color-muted)] transition-transform hover:scale-105 hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] active:scale-95"
          >
            <X size={17} />
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--color-bg)]/40 px-5 py-5 sm:px-6">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 sm:px-6">
            <ButtonRow align="end">{footer}</ButtonRow>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
