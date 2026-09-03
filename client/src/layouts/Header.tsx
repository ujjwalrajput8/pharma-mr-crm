import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  Gift,
  KeyRound,
  LogOut,
  MapPinOff,
  Menu,
  Moon,
  Settings,
  Sun,
  UserRound,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NAV_ITEMS } from '@/constants/navigation';
import {
  countActionable,
  notificationsApi,
  type NotificationKind,
} from '@/services/notifications.service';
import { cn } from '@/utils/cn';

const NOTIFICATION_ICON: Record<
  NotificationKind,
  typeof CalendarDays
> = {
  LEAVE_PENDING: CalendarDays,
  LEAVE_DECIDED: CalendarCheck2,
  ATTENDANCE_FLAGGED: MapPinOff,
  ATTENDANCE_MISSING: UserX,
  APPOINTMENT_TODAY: CalendarCheck2,
  DOCTOR_OCCASION: Gift,
};

const TONE_CLASS: Record<string, string> = {
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  neutral: 'bg-[var(--color-bg)] text-[var(--color-muted)]',
};

function relativeTime(at: string | null): string {
  if (!at) return '';
  const diffMs = Date.now() - new Date(at).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 0) return 'today';
  if (days < 0) return `in ${Math.abs(days)}d`;
  return `${days}d ago`;
}

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

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    // Cheap derived query; refresh often enough that an approver notices.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const feed = notificationsQuery.data;
  const actionable = countActionable(feed);

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
                {actionable > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white ring-2 ring-[var(--color-surface)]">
                    {actionable > 9 ? '9+' : actionable}
                  </span>
                ) : null}
              </Button>
              {notifOpen ? (
                <div className="absolute right-0 mt-2 w-[21rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-scale-in">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-3">
                    <p className="text-[11px] font-bold tracking-wider text-[var(--color-ink)] uppercase">
                      Notifications
                    </p>
                    {actionable > 0 ? (
                      <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-danger)]">
                        {actionable} need action
                      </span>
                    ) : null}
                  </div>

                  {notificationsQuery.isLoading ? (
                    <div className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                      Loading…
                    </div>
                  ) : (feed?.items.length ?? 0) === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <BellOff size={20} className="mx-auto text-[var(--color-muted)]" />
                      <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">
                        Nothing needs you
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                        Leave requests and flagged check-ins show up here.
                      </p>
                    </div>
                  ) : (
                    <ul className="max-h-[22rem] divide-y divide-[var(--color-border)] overflow-y-auto">
                      {feed?.items.map((item) => {
                        const Icon = NOTIFICATION_ICON[item.kind] ?? Bell;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setNotifOpen(false);
                                navigate(item.href);
                              }}
                              className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg)]/60"
                            >
                              <span
                                className={cn(
                                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                                  TONE_CLASS[item.tone] ?? TONE_CLASS.neutral,
                                )}
                              >
                                <Icon size={13} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-[var(--color-ink)]">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-muted)]">
                                  {item.message}
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] whitespace-nowrap text-[var(--color-muted)]/70">
                                {relativeTime(item.at)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {(feed?.items.length ?? 0) > 0 ? (
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          navigate('/approvals');
                        }}
                        className="w-full cursor-pointer text-center text-[11px] font-bold text-[var(--color-primary)] hover:underline"
                      >
                        Open approvals inbox
                      </button>
                    </div>
                  ) : null}
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
                        navigate('/profile?change-password=1');
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
