import type { Permission } from '@/types';
import {
  LayoutDashboard,
  Cake,
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
    permissions: ['dashboard:view'],
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
    label: 'Manager Access',
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
