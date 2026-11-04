import { useEffect, useRef, type ReactNode, type ComponentType } from 'react';
import { X } from 'lucide-react';
import { Button, ButtonRow } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Page';
import { cn } from '@/utils/cn';

/** Dialogs currently open, innermost last — Escape and the scroll lock follow it. */
const openDialogs: object[] = [];

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
  /** No header bar or footer strip: the children draw the whole dialog (confirmations). */
  bare?: boolean;
  /** A failed save, shown at the top of the dialog — where the user is looking. */
  error?: string | null;
}

/**
 * Dialog shell. Deliberately quiet: one hairline header, generous body padding
 * and a footer that sticks so the primary action never scrolls out of reach.
 * Sections inside come from `FormSection`, which uses labels + dividers rather
 * than nested boxes — nested bordered cards are what makes a form look dated.
 */
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
  bare = false,
  error,
}: ModalProps) {
  // Kept in a ref so a parent re-render (new onClose identity) doesn't re-run
  // the effect below and move this dialog to the top of the stack.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // A long form is usually scrolled to the bottom when Save fails — bring the message into view.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const token = {};
    openDialogs.push(token);
    const onKey = (event: KeyboardEvent) => {
      // A dialog opened on top of another one: Escape closes only the top one.
      if (event.key === 'Escape' && openDialogs[openDialogs.length - 1] === token) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      if (openDialogs.length === 0) document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={bare ? title : undefined}
        className={cn(
          'relative z-10 flex max-h-[min(94vh,900px)] w-full max-w-lg flex-col overflow-hidden',
          'rounded-t-[26px] border border-[var(--color-border)] bg-[var(--color-surface)]',
          'shadow-[0_24px_70px_-12px_rgba(15,23,42,0.32)] animate-scale-in sm:rounded-[22px]',
          className,
        )}
      >
        {/* Grab handle for the mobile bottom-sheet form factor. */}
        <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-[var(--color-border-strong)]" />
        </div>

        {bare ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        ) : (
          <>
            <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-4 sm:px-6 sm:pt-5">
              <div className="flex min-w-0 items-start gap-3">
                {Icon ? (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon size={17} />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {title ? (
                      <h3 className="text-[15px] leading-tight font-bold tracking-[-0.015em] text-[var(--color-ink)] sm:text-base">
                        {title}
                      </h3>
                    ) : null}
                    {badge ? (
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--color-primary)] uppercase">
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  {description ? (
                    <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
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
                className="-mt-0.5 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]"
              >
                <X size={16} />
              </Button>
            </header>

            <div className="h-px shrink-0 bg-[var(--color-border)]" />

            <div ref={bodyRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {error ? (
                <div role="alert">
                  <Alert message={error} />
                </div>
              ) : null}
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-5 py-3.5 backdrop-blur-sm sm:px-6">
                <ButtonRow align="end">{footer}</ButtonRow>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A labelled group of fields. No border, no nested card — just a small heading
 * with a hairline, so long forms read as one continuous sheet.
 */
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
    <section className={cn('space-y-3.5', className)}>
      {title ? (
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Icon size={12} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h4 className="text-[11px] leading-none font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              {title}
            </h4>
            {subtitle ? (
              <p className="mt-1 text-[11px] leading-tight text-[var(--color-muted)]/80">
                {subtitle}
              </p>
            ) : null}
          </div>
          <span className="ml-1 h-px flex-1 bg-[var(--color-border)]" aria-hidden />
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  );
}
