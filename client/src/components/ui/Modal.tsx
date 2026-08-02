import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-[#082825]/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-md)] animate-scale-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" className="!px-2 !py-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
