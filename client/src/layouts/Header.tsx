import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  Moon,
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

  return (
    <>
      <header className="z-30 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md shadow-2xs">
        <div className="flex h-15 items-center gap-3 px-4 md:px-6">
          <Button
            variant="secondary"
            size="icon-sm"
            className="lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
          >
            <Menu size={16} />
          </Button>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <img
              src="/jovance-logo.png"
              alt=""
              className="h-8.5 w-auto object-contain [[data-theme=dark]_&]:hidden"
            />
            <img
              src="/jovance-logo-dark.png"
              alt=""
              className="hidden h-8.5 w-auto object-contain [[data-theme=dark]_&]:block"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold tracking-wider text-[var(--color-ink)] uppercase">
                JOVANCE LABORATORIES
              </p>
              <nav className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] font-medium">
                <Link to="/dashboard" className="hover:text-[var(--color-primary)] transition-colors">
                  Home
                </Link>
                <span>/</span>
                <span className="font-semibold text-[var(--color-ink)]">{crumb}</span>
              </nav>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative" ref={notifRef}>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setMenuOpen(false);
                }}
                className="relative"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-surface)]" />
              </Button>
              {notifOpen ? (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-scale-in">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg)]/40">
                    <p className="text-xs font-bold tracking-wider text-[var(--color-ink)] uppercase">
                      Notifications
                    </p>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
                      2 New
                    </span>
                  </div>
                  <ul className="divide-y divide-[var(--color-border)] text-sm">
                    <li className="px-4 py-3 hover:bg-[var(--color-bg)]/50 transition-colors cursor-pointer">
                      <p className="font-semibold text-xs text-[var(--color-ink)]">Pending Follow-ups</p>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">Check Visits for doctors due today.</p>
                    </li>
                    <li className="px-4 py-3 hover:bg-[var(--color-bg)]/50 transition-colors cursor-pointer">
                      <p className="font-semibold text-xs text-[var(--color-ink)]">Stock Alerts</p>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">Review low stock levels in Stock module.</p>
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>

            <Button
              variant="secondary"
              size="icon"
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
                className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pr-2.5 pl-1.5 shadow-xs transition-all hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] cursor-pointer"
              >
                <span className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-bold text-white shadow-2xs">
                  {initials(user?.fullName)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[8.5rem] truncate text-xs font-bold text-[var(--color-ink)]">
                    {user?.fullName}
                  </span>
                </span>
                <Badge tone="primary" dot={false}>{user?.role}</Badge>
                <ChevronDown size={14} className="text-[var(--color-muted)] transition-transform duration-150" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-[var(--shadow-lg)] animate-scale-in">
                  <div className="border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg)]/30">
                    <p className="text-sm font-bold text-[var(--color-ink)]">{user?.fullName}</p>
                    <p className="text-xs text-[var(--color-muted)] truncate">{user?.email}</p>
                  </div>
                  <div className="p-1 space-y-0.5">
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
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer',
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--color-ink)] hover:bg-[var(--color-bg)]',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
