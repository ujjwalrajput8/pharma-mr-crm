import type { Permission } from '@/types';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Store,
  Pill,
  CalendarDays,
  ClipboardList,
  Package,
  Truck,
  BarChart3,
  Settings,
  ScrollText,
  IndianRupee,
  Clock3,
  Sun,
  Inbox,
  BookOpen,
  Map,
  Shield,
  CalendarCheck2,
  PartyPopper,
  IdCard,
  FileSliders,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions: Permission[];
  section?: string;
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
    label: 'My Day',
    path: '/my-day',
    icon: Sun,
    permissions: ['myday:own'],
    section: 'Field',
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: Inbox,
    permissions: ['approvals:team'],
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
    label: 'Attendance',
    path: '/attendance',
    icon: Clock3,
    permissions: ['attendance:manage', 'attendance:own'],
    section: 'Field',
  },
  {
    label: 'Leave',
    path: '/leave',
    icon: CalendarCheck2,
    permissions: ['leaves:own', 'leaves:manage'],
    section: 'Field',
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: CalendarDays,
    permissions: ['appointments:manage', 'appointments:own'],
    section: 'Field',
  },
  {
    label: 'Visits / DCR',
    path: '/visits',
    icon: ClipboardList,
    permissions: ['visits:manage', 'visits:own'],
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
    label: 'Holiday Calendar',
    path: '/holidays',
    icon: PartyPopper,
    permissions: ['holidays:manage'],
    section: 'People',
  },
  {
    label: 'Leave Policy',
    path: '/leave-policy',
    icon: FileSliders,
    permissions: ['leave-types:manage'],
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
