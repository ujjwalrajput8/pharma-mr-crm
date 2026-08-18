import { useEffect, type ReactNode, type ComponentType } from 'react';
import { X } from 'lucide-react';
import { Button, ButtonRow } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  description,
  icon: Icon,
  badge,
  onClose,
  children,
  className,
  footer,
}: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[min(94vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-scale-in sm:rounded-2xl',
          className,
        )}
      >
        {/* Modal Top Accent Glow Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--color-primary)] via-teal-400 to-[var(--color-primary)]" />

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5 bg-[var(--color-surface)]/95">
          <div className="flex items-start gap-3.5 min-w-0">
            {Icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-xs">
                <Icon size={20} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {title ? (
                  <h3 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
                    {title}
                  </h3>
                ) : null}
                {badge ? (
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                    {badge}
                  </span>
                ) : null}
              </div>
              {description ? (
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] transition-transform hover:scale-105 active:scale-95"
          >
            <X size={17} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5.5 space-y-4">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xs px-6 py-4">
            <ButtonRow align="end">{footer}</ButtonRow>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Card container for distinct sections in modern forms */
export function FormSection({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4.5 sm:p-5 shadow-xs transition-colors hover:border-[var(--color-border-strong)]/80', className)}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--color-border)]/60 pb-3">
          <div className="flex items-center gap-2.5">
            {Icon ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon size={14} />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                {title}
              </h4>
              {subtitle ? (
                <p className="text-[11px] text-[var(--color-muted)]">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}

