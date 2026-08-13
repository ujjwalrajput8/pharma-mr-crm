import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const { canAny } = useAuth();
  const items = NAV_ITEMS.filter((item) => canAny(item.permissions));

  return (
    <aside className="flex h-svh w-72 shrink-0 flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)]">
      <div className="shrink-0 border-b border-white/10 px-5 py-6">
        <img
          src="/jovance-logo-dark.png"
          alt="Jovance Laboratories Pvt. Ltd."
          className="h-16 w-auto max-w-full object-contain"
        />
        <p className="mt-3 text-xs tracking-wide text-teal-100/70 uppercase">Pharma MR CRM</p>
      </div>

      <nav className="scrollbar-hide min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
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

      <div className="shrink-0 border-t border-white/10 px-4 py-4 text-xs text-teal-100/55">
        © {new Date().getFullYear()} Jovance Laboratories
      </div>
    </aside>
  );
}
