import { AlertTriangle, LogOut, Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

type Variant = 'delete' | 'logout' | 'generic';

interface ConfirmDialogProps {
  open: boolean;
  variant?: Variant;
  /** Defaults per variant — "Are you sure you want to delete?" for a delete. */
  title?: string;
  description?: string;
  /** What the action applies to, shown under "Selected record". */
  recordName?: string;
  /** Where that record lives, e.g. "Doctor Management". */
  recordContext?: string;
  /** Pill in the top-right corner; defaults per variant. */
  badge?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const VARIANTS: Record<
  Variant,
  {
    icon: LucideIcon;
    tone: 'red' | 'gold';
    badge: string;
    title: string;
    description: string;
    confirmLabel: string;
  }
> = {
  delete: {
    icon: Trash2,
    tone: 'red',
    badge: 'Delete',
    title: 'Are you sure you want to delete?',
    description: 'This action cannot be undone. The selected record will be permanently deleted.',
    confirmLabel: 'Delete',
  },
  logout: {
    icon: LogOut,
    tone: 'gold',
    badge: 'Logout',
    title: 'Log out of your account?',
    description: 'You will return to the sign-in screen and can log back in any time.',
    confirmLabel: 'Logout',
  },
  generic: {
    icon: AlertTriangle,
    tone: 'gold',
    badge: 'Confirm',
    title: 'Are you sure?',
    description: 'Please confirm to continue.',
    confirmLabel: 'Confirm',
  },
};

const TONE_CIRCLE = {
  red: 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]',
  gold: 'bg-[var(--color-brand-gold-soft)] text-[var(--color-brand-gold)]',
};

/**
 * Confirmation dialog in the Jovance colours (logo red + gold): icon and pill
 * on top, the question, the record it applies to, then Cancel / confirm.
 */
export function ConfirmDialog({
  open,
  variant = 'delete',
  title,
  description,
  recordName,
  recordContext,
  badge,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { user } = useAuth();
  const preset = VARIANTS[variant];
  const Icon = preset.icon;
  const resolvedTitle = title ?? preset.title;

  // Logging out applies to the signed-in account.
  const record =
    recordName !== undefined
      ? { name: recordName, context: recordContext }
      : variant === 'logout' && user
        ? { name: user.fullName, context: user.email }
        : null;

  return (
    <Modal open={open} onClose={onClose} title={resolvedTitle} bare className="max-w-[400px]">
      <div
        className="h-1 bg-[linear-gradient(90deg,var(--color-brand-red),var(--color-brand-gold))]"
        aria-hidden
      />
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full',
              TONE_CIRCLE[preset.tone],
            )}
          >
            <Icon size={24} />
          </span>
          <span className="rounded-full bg-[var(--color-brand-gold-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-gold)]">
            {badge ?? preset.badge}
          </span>
        </div>

        <div>
          <h3 className="text-[17px] leading-snug font-bold tracking-[-0.015em] text-[var(--color-ink)]">
            {resolvedTitle}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {description ?? preset.description}
          </p>
        </div>

        {record ? (
          <div className="rounded-xl border-l-[3px] border-[var(--color-brand-gold)] bg-[var(--color-bg)] px-4 py-3">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-[var(--color-brand-gold)] uppercase">
              Selected record
            </p>
            <p className="mt-1 truncate text-[15px] font-bold text-[var(--color-ink)]">{record.name}</p>
            {record.context ? (
              <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">{record.context}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={preset.tone === 'red' ? 'brand' : 'primary'}
            size="lg"
            fullWidth
            onClick={onConfirm}
            loading={loading}
          >
            {loading ? null : <Icon size={15} />}
            {loading ? 'Please wait…' : (confirmLabel ?? preset.confirmLabel)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
