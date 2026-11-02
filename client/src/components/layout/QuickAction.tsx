import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

const TILE =
  'group flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-sm active:scale-[0.98] cursor-pointer';

/**
 * One dashboard shortcut: a lucide icon in a soft tile plus a label.
 * Replaces the old emoji pill strip — same links, calmer and theme-aware.
 * Pass `to` to navigate, or `onClick` to open something on the page.
 */
export function QuickAction({
  icon: Icon,
  label,
  ...target
}: { icon: LucideIcon; label: string } & ({ to: string } | { onClick: () => void })) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="truncate text-xs font-semibold text-[var(--color-ink)]">{label}</span>
    </>
  );

  return 'to' in target ? (
    <Link to={target.to} className={TILE}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={target.onClick} className={TILE}>
      {content}
    </button>
  );
}
