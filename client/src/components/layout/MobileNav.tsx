import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { activeNavItem, navItemsFor, type NavItem } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

/**
 * Fixed bottom tab bar for phones (`lg:hidden`). Up to five slots picked by
 * permission priority: My Day (or Dashboard), Tour Plan, Attendance & Leave,
 * Visits, Doctors — taken from the role's menu so labels, icons and permissions
 * stay in one place.
 */
export function MobileNav() {
  const { canAny, role } = useAuth();
  const location = useLocation();

  const items = useMemo(() => {
    const menu = navItemsFor(role);
    // First permitted menu link to that page (form links skipped), e.g. MR "Attendance".
    const permitted = (path: string): NavItem | null =>
      menu.find((item) => !item.action && item.path.split('?')[0] === path && canAny(item.permissions)) ?? null;

    const picked = [
      permitted('/my-day') ?? permitted('/dashboard'),
      permitted('/tour-plan'),
      permitted('/attendance-leave'),
      permitted('/visits'),
      permitted('/doctors'),
    ].filter((item): item is NavItem => item !== null);

    // De-dupe (defensive) and cap at five slots.
    const unique: NavItem[] = [];
    for (const item of picked) {
      if (!unique.some((existing) => existing.path === item.path)) unique.push(item);
    }
    return unique.slice(0, 5);
  }, [canAny, role]);
  const active = activeNavItem(navItemsFor(role), location.pathname, location.search);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        // The slot lights up for its page, e.g. "Attendance" on any Attendance & Leave tab.
        const isActive = active?.path.split('?')[0] === item.path.split('?')[0];
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 transition-colors',
              isActive
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
            <span
              className={cn(
                'max-w-full truncate text-[10px] leading-tight',
                isActive ? 'font-bold' : 'font-medium',
              )}
            >
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
