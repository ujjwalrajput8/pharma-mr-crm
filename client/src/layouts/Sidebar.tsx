import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const { canAny, user } = useAuth();
  const items = NAV_ITEMS.filter((item) => canAny(item.permissions));

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)]">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-teal-200/80">Pharma MR</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Management System</h1>
        <div className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm">
          <p className="text-teal-100/70">Signed in</p>
          <p className="font-medium text-white">{user?.fullName}</p>
          <p className="text-xs text-teal-100/70">{user?.role}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-teal-400/20 text-white shadow-sm'
                    : 'text-teal-50/75 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
