import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const { canAny } = useAuth();
  const items = NAV_ITEMS.filter((item) => canAny(item.permissions));

  let lastSection: string | undefined;

  return (
    <aside className="flex h-svh w-[17rem] shrink-0 flex-col border-r border-white/8 bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)] select-none">
      <div className="shrink-0 border-b border-white/8 px-5 py-5 bg-black/20">
        <img
          src="/jovance-logo-dark.png"
          alt="Jovance Laboratories Pvt. Ltd."
          className="h-11 w-auto max-w-full object-contain"
        />
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-[0.08em] uppercase">
            <span className="text-[#f59e0b]">Jovance</span>{' '}
            <span className="text-[#ef4444]">Laboratories</span>
          </p>
          <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[9px] font-bold text-teal-300 border border-teal-500/30 uppercase tracking-wider">
            CRM Pro
          </span>
        </div>
      </div>

      <nav className="scrollbar-hide min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.path}>
              {showSection ? (
                <p className="mt-4 mb-1.5 px-3 text-[10px] font-bold tracking-[0.14em] text-teal-200/40 uppercase first:mt-1">
                  {item.section}
                </p>
              ) : null}
              <NavLink
                to={item.path}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-teal-500/15 text-white font-semibold shadow-xs border border-teal-500/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                    ) : null}
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.2 : 1.75}
                      className={cn(
                        'shrink-0 transition-colors',
                        isActive
                          ? 'text-teal-400'
                          : 'text-slate-400 group-hover:text-teal-300',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/8 px-5 py-3.5 text-[10px] font-medium text-slate-500 bg-black/20 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Jovance Labs</span>
        <span className="text-teal-400 font-bold">v1.2.0</span>
      </div>
    </aside>
  );
}
