/**
 * Permission catalog — single source for assignable keys + labels.
 * Admin can grant these to Managers (beyond / instead of role defaults).
 */

export const PERMISSION_CATALOG = [
  { key: 'dashboard:view', label: 'Dashboard', group: 'Overview' },
  { key: 'myday:own', label: 'My Day (field)', group: 'Field' },
  { key: 'approvals:team', label: 'Approvals inbox', group: 'Field' },
  { key: 'attendance:own', label: 'Own attendance check-in', group: 'Field' },
  { key: 'attendance:manage', label: 'Manage team attendance', group: 'Field' },
  { key: 'tour-plan:own', label: 'Own tour plan', group: 'Field' },
  { key: 'tour-plan:manage', label: 'Approve / manage tour plans', group: 'Field' },
  { key: 'appointments:own', label: 'Own appointments', group: 'Field' },
  { key: 'appointments:manage', label: 'Team appointments', group: 'Field' },
  { key: 'visits:own', label: 'Own visits / DCR', group: 'Field' },
  { key: 'visits:manage', label: 'Team visits', group: 'Field' },
  { key: 'leaves:own', label: 'Apply / view own leave', group: 'People' },
  { key: 'leaves:manage', label: 'Approve team leave', group: 'People' },
  { key: 'employees:view', label: 'Employee directory & profiles', group: 'People' },
  { key: 'holidays:manage', label: 'Holiday calendar', group: 'People' },
  { key: 'leave-types:manage', label: 'Leave policy (types & quota)', group: 'People' },
  { key: 'doctors:own', label: 'Assigned doctors', group: 'Masters' },
  { key: 'doctors:manage', label: 'Manage doctors', group: 'Masters' },
  { key: 'stores:manage', label: 'Chemists / stores', group: 'Masters' },
  { key: 'medicines:manage', label: 'Products', group: 'Masters' },
  { key: 'batches:manage', label: 'Batches', group: 'Masters' },
  { key: 'mystock:own', label: 'My stock', group: 'Stock' },
  { key: 'stock:manage', label: 'Stock balances / issue', group: 'Stock' },
  { key: 'ledger:view', label: 'Ledger explorer', group: 'Stock' },
  { key: 'medicine-issues:manage', label: 'Issue to MR', group: 'Stock' },
  { key: 'medicine-issues:own', label: 'My medicine issues', group: 'Stock' },
  { key: 'distributions:manage', label: 'Sample given (team)', group: 'Stock' },
  { key: 'distributions:own', label: 'My samples', group: 'Stock' },
  { key: 'sales:manage', label: 'Sales / POB (team)', group: 'Commercial' },
  { key: 'sales:own', label: 'My sales', group: 'Commercial' },
  { key: 'reports:all', label: 'All reports', group: 'Commercial' },
  { key: 'reports:own', label: 'Own reports', group: 'Commercial' },
  { key: 'users:manage', label: 'Users & hierarchy', group: 'System' },
  { key: 'settings:manage', label: 'Settings', group: 'System' },
  { key: 'audit:view', label: 'Audit log', group: 'System' },
  { key: 'profile:own', label: 'Own profile', group: 'System' },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

/** Default Manager permissions (Admin can customize per manager). */
export const DEFAULT_MANAGER_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard:view',
  'myday:own',
  'approvals:team',
  'doctors:manage',
  'doctors:own',
  'stores:manage',
  'medicines:manage',
  'appointments:manage',
  'appointments:own',
  'visits:manage',
  'visits:own',
  'tour-plan:manage',
  'tour-plan:own',
  'distributions:manage',
  'medicine-issues:manage',
  'stock:manage',
  'ledger:view',
  'mystock:own',
  'reports:all',
  'sales:manage',
  'attendance:manage',
  'attendance:own',
  'leaves:own',
  'leaves:manage',
  'employees:view',
  'profile:own',
];

export const DEFAULT_MR_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard:view',
  'myday:own',
  'doctors:own',
  'appointments:own',
  'visits:own',
  'tour-plan:own',
  'distributions:own',
  'medicine-issues:own',
  'mystock:own',
  'reports:own',
  'sales:own',
  'attendance:own',
  'leaves:own',
  'profile:own',
];

/** Admin gets everything except the personal field-force screens. */
export const DEFAULT_ADMIN_PERMISSIONS: readonly PermissionKey[] = PERMISSION_CATALOG.map(
  (p) => p.key,
).filter(
  (k) =>
    k !== 'myday:own' &&
    k !== 'attendance:own' &&
    k !== 'mystock:own' &&
    k !== 'leaves:own',
);
