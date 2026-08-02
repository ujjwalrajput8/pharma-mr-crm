import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NAV_ITEMS } from '@/constants/navigation';
import { cn } from '@/utils/cn';

interface HeaderProps {
  onToggleSidebar: () => void;
}

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout, can } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const crumb = useMemo(() => {
    const match = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
    if (location.pathname.startsWith('/profile')) return 'My Profile';
    return match?.label ?? 'Workspace';
  }, [location.pathname]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function confirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('You have been logged out successfully.');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed', 'Please try again.');
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    if (q.includes('doctor')) navigate('/doctors');
    else if (q.includes('medicine') || q.includes('stock')) navigate('/medicines');
    else if (q.includes('appoint')) navigate('/appointments');
    else if (q.includes('visit')) navigate('/visits');
    else if (q.includes('report')) navigate('/reports');
    else if (q.includes('sale')) navigate('/sales');
    else toast.info('Search', `No quick match for “${search.trim()}”. Use module filters.`);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Button
            variant="secondary"
            className="!px-2.5 !py-2 lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </Button>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
          <img
            src="/jovance-logo.png"
            alt=""
            className="h-9 w-auto object-contain [[data-theme=dark]_&]:hidden"
          />
          <img
            src="/jovance-logo-dark.png"
            alt=""
            className="hidden h-9 w-auto object-contain [[data-theme=dark]_&]:block"
          />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                JOVANCE LABORATORIES
              </p>
              <nav className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                <Link to="/dashboard" className="hover:text-[var(--color-primary)]">
                  Home
                </Link>
                <span>/</span>
                <span className="font-medium text-[var(--color-ink)]">{crumb}</span>
              </nav>
            </div>
          </div>

          <form onSubmit={onSearchSubmit} className="relative mx-auto hidden max-w-md flex-1 lg:block">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctors, medicines, appointments…"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative" ref={notifRef}>
              <Button
                variant="secondary"
                className="!px-2.5 !py-2"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setMenuOpen(false);
                }}
              >
                <Bell size={16} />
              </Button>
              {notifOpen ? (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-md)]">
                  <p className="mb-2 text-sm font-semibold">Notifications</p>
                  <ul className="space-y-2 text-sm">
                    <li className="rounded-xl bg-[var(--color-bg)] px-3 py-2">
                      <p className="font-medium">Pending follow-ups</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        Check Visits for doctors due today.
                      </p>
                    </li>
                    <li className="rounded-xl bg-[var(--color-bg)] px-3 py-2">
                      <p className="font-medium">Stock alerts</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        Review low stock medicines in Stock module.
                      </p>
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>

            <Button
              variant="secondary"
              className="!px-2.5 !py-2"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pr-2.5 pl-1.5 transition hover:shadow-[var(--shadow-sm)]"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white">
                  {initials(user?.fullName)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[9rem] truncate text-sm font-semibold text-[var(--color-ink)]">
                    {user?.fullName}
                  </span>
                  <span className="block text-[11px] text-[var(--color-muted)]">{user?.email}</span>
                </span>
                <Badge tone="primary">{user?.role}</Badge>
                <ChevronDown size={14} className="text-[var(--color-muted)]" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-md)]">
                  <div className="border-b border-[var(--color-border)] px-3 py-2">
                    <p className="text-sm font-semibold">{user?.fullName}</p>
                    <p className="text-xs text-[var(--color-muted)]">{user?.email}</p>
                  </div>
                  <DropdownItem
                    icon={UserRound}
                    label="My Profile"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile');
                    }}
                  />
                  <DropdownItem
                    icon={KeyRound}
                    label="Change Password"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile?tab=password');
                      toast.info('Change Password', 'Use the Change Password section on Profile.');
                    }}
                  />
                  {can('settings:manage') ? (
                    <DropdownItem
                      icon={Settings}
                      label="Settings"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                    />
                  ) : null}
                  <div className="my-1 border-t border-[var(--color-border)]" />
                  <DropdownItem
                    icon={LogOut}
                    label="Logout"
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutOpen(true);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={logoutOpen}
        variant="logout"
        title="Confirm Logout"
        description="Are you sure you want to logout from your account?"
        loading={loggingOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void confirmLogout()}
      />
    </>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof UserRound;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--color-bg)]',
        danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
