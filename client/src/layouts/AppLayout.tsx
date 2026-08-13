import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/layouts/Header';
import { Sidebar } from '@/layouts/Sidebar';
import { cn } from '@/utils/cn';

/**
 * Shared application shell for Admin and MR.
 * Sidebar + header stay fixed; only the main content scrolls.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-svh overflow-hidden bg-[var(--color-bg)]">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <Sidebar />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-72">
        <Header onToggleSidebar={() => setMobileOpen((open) => !open)} />
        <main className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
