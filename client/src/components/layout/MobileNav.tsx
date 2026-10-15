import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

/**
 * Fixed bottom tab bar for phones (`lg:hidden`). Up to five slots picked by
 * permission priority: My Day (or Dashboard), Appointments (or Tour Plan),
 * Attendance, Leave, Approvals — all derived from NAV_ITEMS so labels, icons
 * and permissions stay in one place.
 */
export function MobileNav() {
  const { canAny } = useAuth();

  const items = useMemo(() => {
    const byPath = new Map(NAV_ITEMS.map((item) => [item.path, item]));
    const permitted = (path: string): NavItem | null => {
      const item = byPath.get(path);
      return item && canAny(item.permissions) ? item : null;
    };

    const picked = [
      permitted('/my-day') ?? permitted('/dashboard'),
      permitted('/appointments') ?? permitted('/tour-plan'),
      permitted('/attendance'),
      permitted('/leave'),
      permitted('/approvals'),
    ].filter((item): item is NavItem => item !== null);

    // De-dupe (defensive) and cap at five slots.
    const unique: NavItem[] = [];
    for (const item of picked) {
      if (!unique.some((existing) => existing.path === item.path)) unique.push(item);
    }
    return unique.slice(0, 5);
  }, [canAny]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 transition-colors',
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span
                  className={cn(
                    'max-w-full truncate text-[10px] leading-tight',
                    isActive ? 'font-bold' : 'font-medium',
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
