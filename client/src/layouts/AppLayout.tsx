import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/layouts/Header';
import { Sidebar } from '@/layouts/Sidebar';
import { cn } from '@/utils/cn';

/**
 * Shared application shell for Admin and MR.
 * Navigation content is role-filtered; layout itself is identical.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-[var(--color-bg)]">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
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

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggleSidebar={() => setMobileOpen((open) => !open)} />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
