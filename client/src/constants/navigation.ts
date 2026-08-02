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
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions: Permission[];
}

/**
 * Single shared navigation catalog.
 * Items are filtered by role permissions at render time.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    permissions: ['dashboard:view'],
  },
  {
    label: 'MR Management',
    path: '/users',
    icon: Users,
    permissions: ['users:manage'],
  },
  {
    label: 'Doctors',
    path: '/doctors',
    icon: Stethoscope,
    permissions: ['doctors:manage', 'doctors:own'],
  },
  {
    label: 'Medical Stores',
    path: '/stores',
    icon: Store,
    permissions: ['stores:manage'],
  },
  {
    label: 'Medicines',
    path: '/medicines',
    icon: Pill,
    permissions: ['medicines:manage'],
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: CalendarDays,
    permissions: ['appointments:manage', 'appointments:own'],
  },
  {
    label: 'Visits',
    path: '/visits',
    icon: ClipboardList,
    permissions: ['visits:manage', 'visits:own'],
  },
  {
    label: 'Distribution',
    path: '/distributions',
    icon: Truck,
    permissions: ['distributions:manage', 'distributions:own'],
  },
  {
    label: 'Stock',
    path: '/stock',
    icon: Package,
    permissions: ['stock:manage'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    permissions: ['reports:all', 'reports:own'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    permissions: ['settings:manage'],
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    icon: ScrollText,
    permissions: ['audit:view'],
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: UserRound,
    permissions: ['profile:own'],
  },
];
