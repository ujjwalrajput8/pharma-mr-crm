import type { Permission, Role } from '@/types';
import {
  LayoutDashboard,
  Cake,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Clock3,
  Gift,
  PartyPopper,
  Receipt,
  Users,
  Stethoscope,
  Store,
  Pill,
  ClipboardList,
  Package,
  Truck,
  BarChart3,
  Settings,
  ScrollText,
  IndianRupee,
  Sun,
  BookOpen,
  Map,
  Shield,
  CalendarCheck2,
  IdCard,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions: Permission[];
  section?: string;
  /** Phone bottom bar, where the full label does not fit. */
  shortLabel?: string;
  /** Opens a form (`?new=1`, `&apply=1`) — never shown as the current page. */
  action?: boolean;
}

/**
 * Single shared navigation — filtered by role permissions.
 * Field Force labels aligned to design doc.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    permissions: ['dashboard:view'],
    section: 'Overview',
  },
  {
    label: 'Birthdays & Anniversaries',
    path: '/occasions',
    icon: Cake,
    permissions: ['occasions:view'],
    section: 'Overview',
  },
  {
    label: 'Today',
    path: '/my-day',
    icon: Sun,
    permissions: ['myday:own'],
    section: 'Field',
  },
  {
    label: 'Tour Plan',
    path: '/tour-plan',
    icon: Map,
    permissions: ['tour-plan:manage', 'tour-plan:own'],
    section: 'Field',
  },
  {
    // Attendance, leave, approvals, holiday calendar and leave policy — one module with tabs.
    label: 'Attendance & Leave',
    shortLabel: 'Attendance',
    path: '/attendance-leave',
    icon: CalendarCheck2,
    permissions: ['attendance:own', 'attendance:manage', 'leaves:own', 'leaves:manage'],
    section: 'Field',
  },
  {
    label: 'Expenses (TA/DA)',
    path: '/expenses',
    icon: Wallet,
    permissions: ['expenses:own', 'expenses:manage'],
    section: 'Field',
  },
  {
    label: 'Visits & Appointments',
    shortLabel: 'Visits',
    path: '/visits',
    icon: ClipboardList,
    permissions: ['visits:manage', 'visits:own', 'appointments:manage', 'appointments:own'],
    section: 'Field',
  },
  {
    label: 'Employees',
    path: '/employees',
    icon: IdCard,
    permissions: ['employees:view'],
    section: 'People',
  },
  {
    label: 'Users & Hierarchy',
    path: '/users',
    icon: Users,
    permissions: ['users:manage'],
    section: 'Masters',
  },
  {
    label: 'Manager & MR Access',
    path: '/manager-permissions',
    icon: Shield,
    permissions: ['users:manage'],
    section: 'Masters',
  },
  {
    label: 'Doctors',
    path: '/doctors',
    icon: Stethoscope,
    permissions: ['doctors:manage', 'doctors:own'],
    section: 'Masters',
  },
  {
    label: 'Territories',
    path: '/territories',
    icon: Map,
    permissions: ['territories:manage'],
    section: 'Masters',
  },
  {
    label: 'Chemists / Stores',
    path: '/stores',
    icon: Store,
    permissions: ['stores:manage'],
    section: 'Masters',
  },
  {
    label: 'Products',
    path: '/medicines',
    icon: Pill,
    permissions: ['medicines:manage'],
    section: 'Masters',
  },
  {
    label: 'My Stock',
    path: '/my-stock',
    icon: Package,
    permissions: ['mystock:own'],
    section: 'Stock',
  },
  {
    label: 'Issue to MR',
    path: '/medicine-issues',
    icon: Truck,
    permissions: ['medicine-issues:manage', 'medicine-issues:own'],
    section: 'Stock',
  },
  {
    label: 'Sample Given',
    path: '/distributions',
    icon: Truck,
    permissions: ['distributions:manage', 'distributions:own'],
    section: 'Stock',
  },
  {
    label: 'Stock Balances',
    path: '/stock',
    icon: Package,
    permissions: ['stock:manage'],
    section: 'Stock',
  },
  {
    label: 'Ledger Explorer',
    path: '/ledger',
    icon: BookOpen,
    permissions: ['ledger:view'],
    section: 'Stock',
  },
  {
    label: 'Sales / POB',
    path: '/sales',
    icon: IndianRupee,
    permissions: ['sales:manage', 'sales:own'],
    section: 'Commercial',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    permissions: ['reports:all', 'reports:own'],
    section: 'Commercial',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    permissions: ['settings:manage'],
    section: 'System',
  },
  {
    label: 'Audit Log',
    path: '/audit-logs',
    icon: ScrollText,
    permissions: ['audit:view'],
    section: 'System',
  },
];

/**
 * MR menu — the client's field structure: Dashboard · Submit · View · Stock. Every item
 * hangs on one permission, so Admin switches it on / off for all MRs (Manager & MR
 * Access → MRs). Submit links open the form; View links open the list.
 */
export const MR_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permissions: ['dashboard:view'], section: 'Dashboard' },
  { label: 'Today', path: '/my-day', icon: Sun, permissions: ['myday:own'], section: 'Dashboard' },
  { label: 'Birthdays & Anniversaries', shortLabel: 'Birthdays', path: '/occasions', icon: Cake, permissions: ['occasions:view'], section: 'Dashboard' },

  { label: 'Monthly Tour Program', shortLabel: 'Tour Plan', path: '/tour-plan', icon: Map, permissions: ['tour-plan:own'], section: 'Submit' },
  { label: 'DCR · Doctor Visit', shortLabel: 'DCR', path: '/visits', icon: ClipboardList, permissions: ['visits:own'], section: 'Submit' },
  { label: 'Appointments', path: '/visits?tab=appointments', icon: CalendarClock, permissions: ['appointments:own'], section: 'Submit' },
  { label: 'Expense', path: '/expenses?new=1', icon: Wallet, permissions: ['expenses:own'], section: 'Submit', action: true },
  { label: 'Leave', path: '/attendance-leave?tab=leave&apply=1', icon: CalendarPlus, permissions: ['leaves:own'], section: 'Submit', action: true },
  { label: 'Attendance', path: '/attendance-leave?tab=attendance', icon: Clock3, permissions: ['attendance:own'], section: 'Submit' },

  { label: 'Sales', path: '/sales', icon: IndianRupee, permissions: ['sales:own'], section: 'View' },
  { label: 'MSL List', shortLabel: 'MSL', path: '/doctors', icon: Stethoscope, permissions: ['doctors:own'], section: 'View' },
  { label: 'DCR Report', path: '/reports?type=doctor-visits', icon: BarChart3, permissions: ['reports:own'], section: 'View' },
  { label: 'Holiday', path: '/attendance-leave?tab=holidays', icon: PartyPopper, permissions: ['holidays:view'], section: 'View' },
  { label: 'Leave Balance', path: '/attendance-leave?tab=leave', icon: CalendarRange, permissions: ['leaves:own'], section: 'View' },
  { label: 'Expense', path: '/expenses', icon: Receipt, permissions: ['expenses:own'], section: 'View' },

  { label: 'My Stock', path: '/my-stock', icon: Package, permissions: ['mystock:own'], section: 'Stock' },
  { label: 'Sample Given', path: '/distributions', icon: Gift, permissions: ['distributions:own'], section: 'Stock' },
];

/** Admin and Managers keep the full menu; MRs get theirs. */
export function navItemsFor(role: Role | null | undefined): NavItem[] {
  return role === 'MR' ? MR_NAV_ITEMS : NAV_ITEMS;
}

function splitPath(path: string): { pathname: string; params: URLSearchParams } {
  const [pathname = '', query = ''] = path.split('?');
  return { pathname, params: new URLSearchParams(query) };
}

function matches(item: NavItem, pathname: string, search: URLSearchParams): boolean {
  const target = splitPath(item.path);
  if (pathname !== target.pathname && !pathname.startsWith(`${target.pathname}/`)) return false;
  return [...target.params].every(([key, value]) => search.get(key) === value);
}

/**
 * The menu item for the current page. Links to the same page differ by their query
 * (`?tab=holidays`), so the most specific match wins; form links are never current.
 */
export function activeNavItem(items: NavItem[], pathname: string, search: string): NavItem | null {
  const params = new URLSearchParams(search);
  let best: NavItem | null = null;
  let bestScore = -1;
  for (const item of items) {
    if (item.action || !matches(item, pathname, params)) continue;
    const { pathname: base, params: query } = splitPath(item.path);
    const score = base.length * 10 + [...query].length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
