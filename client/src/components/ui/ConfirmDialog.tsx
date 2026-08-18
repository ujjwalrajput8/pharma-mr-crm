import { AlertTriangle, CheckCircle2, LogOut, ShieldAlert, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/store/AuthContext';
import { Badge } from '@/components/ui/Page';

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
  const { user } = useAuth();
  const isLogout = variant === 'logout';
  const resolvedConfirm = confirmLabel ?? (isLogout ? 'Logout' : 'Delete');

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={isLogout ? LogOut : AlertTriangle}
      badge={isLogout ? 'Account' : 'Irreversible'}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isLogout ? 'primary' : 'destructive'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Please wait…' : resolvedConfirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Jovance Corporate Header Banner */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <img
              src="/jovance-logo.png"
              alt="Jovance Laboratories"
              className="h-8.5 w-auto object-contain [[data-theme=dark]_&]:hidden"
            />
            <img
              src="/jovance-logo-dark.png"
              alt="Jovance Laboratories"
              className="hidden h-8.5 w-auto object-contain [[data-theme=dark]_&]:block"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold tracking-wider text-[var(--color-ink)] uppercase">
                JOVANCE LABORATORIES
              </p>
              <p className="text-[11px] text-[var(--color-muted)] font-medium">Field Force CRM</p>
            </div>
          </div>
          {isLogout && user?.role ? (
            <Badge tone="primary">{user.role}</Badge>
          ) : null}
        </div>

        {/* User Account Info Card for Logout */}
        {isLogout && user ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3.5 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold shadow-xs">
                {user.fullName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('') || <User size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--color-ink)]">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>All doctor visits, reports, and attendance records are synced.</span>
            </div>
          </div>
        ) : null}

        {/* Informational or Warning Callout */}
        {isLogout ? (
          <p className="text-xs text-[var(--color-muted)] leading-relaxed px-1">
            You will be returned to the secure sign-in screen. You can log back in at any time with your employee credentials.
          </p>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span>
              This operation cannot be undone and will permanently delete records from the central database.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}


