import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, ButtonRow } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  description,
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
        className="absolute inset-0 bg-[#0a1f1d]/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] animate-scale-in sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0 pt-0.5">
            {title ? (
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X size={15} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 py-2.5 sm:px-5">
            <ButtonRow align="end">{footer}</ButtonRow>
          </div>
        ) : null}
      </div>
    </div>
  );
}
