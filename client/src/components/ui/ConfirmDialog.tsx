import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ConfirmDialogProps {
  open: boolean;
  variant?: 'delete' | 'logout' | 'generic';
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Branded enterprise confirmation dialog for destructive / logout actions.
 */
export function ConfirmDialog({
  open,
  variant = 'delete',
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const isLogout = variant === 'logout';
  const resolvedConfirm = confirmLabel ?? (isLogout ? 'Logout' : 'Delete');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      className="max-w-md overflow-hidden !p-0"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
            {cancelLabel}
          </Button>
          <Button
            variant={isLogout ? 'primary' : 'danger'}
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Please wait…' : resolvedConfirm}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-1 pb-1">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
          <img
            src="/jovance-logo.png"
            alt="Jovance Laboratories"
            className="h-10 w-auto object-contain [[data-theme=dark]_&]:hidden"
          />
          <img
            src="/jovance-logo-dark.png"
            alt="Jovance Laboratories"
            className="hidden h-10 w-auto object-contain [[data-theme=dark]_&]:block"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              JOVANCE LABORATORIES PVT. LTD.
            </p>
            <p className="text-xs text-[var(--color-muted)]">Pharma MR CRM</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-xl p-2.5 ${
              isLogout
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
            }`}
          >
            {isLogout ? <LogOut size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
            {!isLogout && variant === 'delete' ? (
              <p className="mt-2 text-xs font-medium text-[var(--color-danger)]">
                This action cannot be undone.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
