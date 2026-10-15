import { useEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { APP_VERSION } from '@/constants/appMeta';
import { NAV_ITEMS, type NavItem } from '@/constants/navigation';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

type SidebarProps = {
  onNavigate?: () => void;
  /** Icon-only rail (labels + section headers hidden). Owned by AppLayout. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onOpenSearch?: () => void;
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

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapsed, onOpenSearch }: SidebarProps) {
  const groups = useNavGroups();
  const navRef = useRef<HTMLElement | null>(null);

  // Bring the active item into view on mount — long menus otherwise hide it.
  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-current="page"]');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'center' });
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      className={cn(
        'flex h-svh shrink-0 flex-col border-r border-white/8 bg-[var(--color-sidebar)] text-[var(--color-sidebar-ink)] select-none transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-[16.5rem]',
      )}
    >
      <div
        className={cn(
          'shrink-0 border-b border-white/8 bg-black/25',
          collapsed ? 'flex justify-center px-2 py-4' : 'px-4 py-4',
        )}
      >
        {collapsed ? (
          <span
            title="Jovance Laboratories"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/12 text-[13px] font-bold tracking-tight text-teal-300"
          >
            JL
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>

      <nav ref={navRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((group, groupIndex) => (
          <div key={group.section || `group-${groupIndex}`} className="mb-1">
            {group.section ? (
              collapsed ? (
                groupIndex > 0 ? (
                  <div aria-hidden className="mx-2 my-2 h-px bg-white/8" />
                ) : null
              ) : (
                <p
                  className={cn(
                    'mb-1 px-2.5 text-[9.5px] font-bold tracking-[0.16em] text-teal-200/35 uppercase',
                    groupIndex === 0 ? 'mt-0.5' : 'mt-4',
                  )}
                >
                  {group.section}
                </p>
              )
            ) : null}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onNavigate?.()}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center rounded-[10px] py-2 text-[12.5px] transition-all duration-150',
                        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
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
                          size={collapsed ? 17 : 15.5}
                          strokeWidth={isActive ? 2.2 : 1.75}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive ? 'text-teal-300' : 'text-slate-500 group-hover:text-teal-300',
                          )}
                        />
                        {collapsed ? null : <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Search trigger — opens the Ctrl+K palette. */}
      <div className={cn('shrink-0 border-t border-white/8 px-2.5 py-2', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={() => onOpenSearch?.()}
          title="Search (Ctrl+K)"
          className={cn(
            'flex w-full cursor-pointer items-center rounded-[10px] py-2 text-[12px] font-medium text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-white',
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
          )}
        >
          <Search size={collapsed ? 16 : 14} className="shrink-0 text-slate-500" />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-slate-400">
                Ctrl K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Bottom bar: version footer + collapse toggle (desktop only). */}
      <div
        className={cn(
          'flex shrink-0 items-center border-t border-white/8 bg-black/25 text-[10px] font-medium text-slate-500',
          collapsed ? 'flex-col gap-1.5 px-2 py-2.5' : 'justify-between gap-2 px-4 py-2.5',
        )}
      >
        {collapsed ? (
          <span className="font-bold text-teal-400/80" title={`© ${new Date().getFullYear()} Jovance Labs`}>
            v{APP_VERSION}
          </span>
        ) : (
          <span className="truncate">
            © {new Date().getFullYear()} Jovance Labs{' '}
            <span className="ml-1 font-bold text-teal-400/80">v{APP_VERSION}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggleCollapsed?.()}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white lg:flex"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </aside>
  );
}
