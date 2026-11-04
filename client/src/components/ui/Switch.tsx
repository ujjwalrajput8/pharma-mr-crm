import { cn } from '@/utils/cn';

/** On / off toggle (role="switch"). The label is for screen readers; show visible text beside it. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-strong)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
