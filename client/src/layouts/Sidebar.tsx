import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

type SidebarProps = {
  onNavigate?: () => void;
};

/** Groups the permitted nav items by section, preserving declaration order. */
function useNavGroups(): Array<{ section: string; items: NavItem[] }> {
  const { canAny } = useAuth();

  return useMemo(() => {
    const groups: Array<{ section: string; items: NavItem[] }> = [];
    for (const item of NAV_ITEMS) {
      if (!canAny(item.permissions)) continue;
      const section = item.section ?? '';
      const last = groups[groups.length - 1];
      if (last && last.section === section) last.items.push(item);
      else groups.push({ section, items: [item] });
    }
    return groups;
  }, [canAny]);
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const groups = useNavGroups();

  return (
    <aside className="flex h-svh w-[16.5rem] shrink-0 flex-col border-r border-white/8 bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)] select-none">
      <div className="shrink-0 border-b border-white/8 bg-black/25 px-4 py-4">
        <img
          src="/jovance-logo-dark.png"
          alt="Jovance Laboratories Pvt. Ltd."
          className="h-10 w-auto max-w-full object-contain"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase">
            <span className="text-[#f59e0b]">Jovance</span>{' '}
            <span className="text-[#ef4444]">Laboratories</span>
          </p>
          <span className="rounded-full border border-teal-500/30 bg-teal-500/12 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-teal-300 uppercase">
            Field Force
          </span>
        </div>
      </div>

      <nav className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((group, groupIndex) => (
          <div key={group.section || `group-${groupIndex}`} className="mb-1">
            {group.section ? (
              <p
                className={cn(
                  'mb-1 px-2.5 text-[9.5px] font-bold tracking-[0.16em] text-teal-200/35 uppercase',
                  groupIndex === 0 ? 'mt-0.5' : 'mt-4',
                )}
              >
                {group.section}
              </p>
            ) : null}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] transition-all duration-150',
                        isActive
                          ? 'bg-teal-500/14 font-semibold text-white'
                          : 'font-medium text-slate-400 hover:bg-white/[0.055] hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <span
                            aria-hidden
                            className="absolute top-1.5 bottom-1.5 -left-2.5 w-[3px] rounded-r-full bg-teal-400"
                          />
                        ) : null}
                        <Icon
                          size={15.5}
                          strokeWidth={isActive ? 2.2 : 1.75}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive ? 'text-teal-300' : 'text-slate-500 group-hover:text-teal-300',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center justify-between border-t border-white/8 bg-black/25 px-4 py-3 text-[10px] font-medium text-slate-500">
        <span>© {new Date().getFullYear()} Jovance Labs</span>
        <span className="font-bold text-teal-400/80">v1.2.0</span>
      </div>
    </aside>
  );
}
