import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const { canAny } = useAuth();
  const items = NAV_ITEMS.filter((item) => canAny(item.permissions));

  let lastSection: string | undefined;

  return (
    <aside className="flex h-svh w-[16.5rem] shrink-0 flex-col border-r border-white/5 bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)]">
      <div className="shrink-0 border-b border-white/8 px-4 py-5">
        <img
          src="/jovance-logo-dark.png"
          alt="Jovance Laboratories Pvt. Ltd."
          className="h-12 w-auto max-w-full object-contain"
        />
        <p className="mt-2.5 text-[10px] font-semibold tracking-[0.14em] text-teal-100/50 uppercase">
          Field Force
        </p>
      </div>

      <nav className="scrollbar-hide min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {items.map((item) => {
          const Icon = item.icon;
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.path}>
              {showSection ? (
                <p className="mt-3 mb-1 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-teal-100/35 uppercase first:mt-0">
                  {item.section}
                </p>
              ) : null}
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-teal-50/70 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/8 px-4 py-3 text-[10px] text-teal-100/40">
        © {new Date().getFullYear()} Jovance Laboratories
      </div>
    </aside>
  );
}
