/**
 * Permission catalog — single source for assignable keys + labels.
 * Admin can grant these to Managers (beyond / instead of role defaults).
 */

export const PERMISSION_CATALOG = [
  { key: 'dashboard:view', label: 'Dashboard', group: 'Overview' },
  { key: 'occasions:view', label: 'Birthdays & anniversaries', group: 'Overview' },
  { key: 'myday:own', label: 'My Day (field)', group: 'Field' },
  { key: 'approvals:own', label: 'My approval status', group: 'Field' },
  { key: 'approvals:team', label: 'Approvals inbox', group: 'Field' },
  { key: 'attendance:own', label: 'Own attendance check-in', group: 'Field' },
  { key: 'attendance:manage', label: 'Manage team attendance', group: 'Field' },
  { key: 'tour-plan:own', label: 'Own tour plan', group: 'Field' },
  { key: 'tour-plan:manage', label: 'Approve / manage tour plans', group: 'Field' },
  { key: 'appointments:own', label: 'Own appointments', group: 'Field' },
  { key: 'appointments:manage', label: 'Team appointments', group: 'Field' },
  { key: 'visits:own', label: 'Own visits / DCR', group: 'Field' },
  { key: 'visits:manage', label: 'Team visits', group: 'Field' },
  { key: 'chemist-visits:own', label: 'Own chemist calls (DCR)', group: 'Field' },
  { key: 'stockist-visits:own', label: 'Own stockist calls (DCR)', group: 'Field' },
  { key: 'leaves:own', label: 'Apply / view own leave', group: 'People' },
  { key: 'leaves:manage', label: 'Approve team leave', group: 'People' },
  { key: 'employees:view', label: 'Employee directory & profiles', group: 'People' },
  { key: 'holidays:view', label: 'Holiday calendar (view)', group: 'People' },
  { key: 'holidays:manage', label: 'Holiday calendar', group: 'People' },
  { key: 'leave-types:manage', label: 'Leave policy (types & quota)', group: 'People' },
  { key: 'expenses:own', label: 'Own expense claims (TA/DA)', group: 'Field' },
  { key: 'expenses:manage', label: 'Approve team expenses', group: 'Field' },
  { key: 'doctors:own', label: 'Assigned doctors', group: 'Masters' },
  { key: 'doctors:manage', label: 'Manage doctors', group: 'Masters' },
  { key: 'territories:manage', label: 'Territories (HQ / beats)', group: 'Masters' },
  { key: 'stores:manage', label: 'Chemists / stores', group: 'Masters' },
  { key: 'msl-requests:own', label: 'MSL add / remove requests', group: 'Masters' },
  { key: 'msl-requests:manage', label: 'Approve MSL requests', group: 'Masters' },
  { key: 'stockist-statement:own', label: 'Stockist statements (enter)', group: 'Commercial' },
  { key: 'stockist-statement:manage', label: 'Stockist statements (team, correct)', group: 'Commercial' },
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
  { key: 'targets:manage', label: 'Sales targets', group: 'Commercial' },
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
  'occasions:view',
  'holidays:view',
  'myday:own',
  'approvals:team',
  'doctors:manage',
  'doctors:own',
  'stores:manage',
  'msl-requests:manage',
  'stockist-statement:manage',
  'medicines:manage',
  'appointments:manage',
  'appointments:own',
  'visits:manage',
  'visits:own',
  'chemist-visits:own',
  'stockist-visits:own',
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
  'expenses:own',
  'expenses:manage',
  'targets:manage',
  'profile:own',
];

export const DEFAULT_MR_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard:view',
  'occasions:view',
  'holidays:view',
  'myday:own',
  'doctors:own',
  'appointments:own',
  'visits:own',
  'chemist-visits:own',
  'stockist-visits:own',
  'tour-plan:own',
  'distributions:own',
  'medicine-issues:own',
  'mystock:own',
  'reports:own',
  'sales:own',
  'attendance:own',
  'leaves:own',
  'expenses:own',
  'msl-requests:own',
  'approvals:own',
  'stockist-statement:own',
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
    k !== 'leaves:own' &&
    k !== 'expenses:own' &&
    k !== 'msl-requests:own' &&
    k !== 'approvals:own' &&
    k !== 'stockist-statement:own',
);

/**
 * The MR menu switches Admin turns on / off for every MR (Manager & MR Access → MRs),
 * grouped like the MR menu. Each switch is the permission behind that menu item;
 * MR permissions outside this list always follow the role defaults.
 */
export const MR_ACCESS_ITEMS = [
  { key: 'myday:own', label: 'Today', section: 'Dashboard' },
  { key: 'occasions:view', label: 'Birthdays & Anniversaries', section: 'Dashboard' },
  { key: 'tour-plan:own', label: 'Monthly Tour Program', section: 'Submit' },
  { key: 'visits:own', label: 'DCR · Doctor visit', section: 'Submit' },
  { key: 'chemist-visits:own', label: 'DCR · Chemist visit', section: 'Submit' },
  { key: 'stockist-visits:own', label: 'DCR · Stockist visit', section: 'Submit' },
  { key: 'appointments:own', label: 'Appointments', section: 'Submit' },
  { key: 'expenses:own', label: 'Expense', section: 'Submit' },
  { key: 'leaves:own', label: 'Leave & leave balance', section: 'Submit' },
  { key: 'attendance:own', label: 'Attendance', section: 'Submit' },
  { key: 'stockist-statement:own', label: 'Monthly / Quarterly / Yearly', section: 'Stockist Statement' },
  { key: 'sales:own', label: 'Sales', section: 'View' },
  { key: 'doctors:own', label: 'MSL List', section: 'View' },
  { key: 'reports:own', label: 'DCR Report', section: 'View' },
  { key: 'holidays:view', label: 'Holiday', section: 'View' },
  { key: 'msl-requests:own', label: 'Doctor / Chemist / Stockist add & remove', section: 'MSL Management' },
  { key: 'approvals:own', label: 'Status of my requests', section: 'Approval' },
  { key: 'mystock:own', label: 'My Stock', section: 'Stock' },
  { key: 'distributions:own', label: 'Sample Given', section: 'Stock' },
] as const satisfies readonly { key: PermissionKey; label: string; section: string }[];
