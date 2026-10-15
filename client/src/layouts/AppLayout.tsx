import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { MobileNav } from '@/components/layout/MobileNav';
import { Header } from '@/layouts/Header';
import { Sidebar } from '@/layouts/Sidebar';
import { cn } from '@/utils/cn';

const COLLAPSE_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Shared application shell for Admin, Manager, and MR.
 * One login / one layout — menus filtered by RBAC.
 * Owns the sidebar collapse state, the Ctrl+K palette and the mobile tab bar.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Private mode / blocked storage — the toggle still works for this session.
      }
      return next;
    });
  }, []);

  // The mobile drawer always shows the full menu; the rail is a desktop thing.
  const railCollapsed = collapsed && !mobileOpen;

  return (
    <div className="flex h-svh overflow-hidden bg-[var(--color-bg)]">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <Sidebar
          onNavigate={() => setMobileOpen(false)}
          collapsed={railCollapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenSearch={() => {
            setMobileOpen(false);
            setSearchOpen(true);
          }}
        />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16.5rem]',
        )}
      >
        <Header onToggleSidebar={() => setMobileOpen((open) => !open)} />
        <main className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 pb-20 md:p-5 md:pb-20 lg:pb-5">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
