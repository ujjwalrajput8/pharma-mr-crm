import type { Permission, Role } from '@/types';

/**
 * Role → default permission map (fallback when API has not sent permissions yet).
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    'dashboard:view',
    'approvals:team',
    'users:manage',
    'doctors:manage',
    'stores:manage',
    'medicines:manage',
    'batches:manage',
    'appointments:manage',
    'visits:manage',
    'tour-plan:manage',
    'distributions:manage',
    'medicine-issues:manage',
    'stock:manage',
    'ledger:view',
    'reports:all',
    'sales:manage',
    'attendance:manage',
    'leaves:manage',
    'employees:view',
    'holidays:manage',
    'leave-types:manage',
    'settings:manage',
    'audit:view',
    'profile:own',
  ],
  MANAGER: [
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
  ],
  MR: [
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
  ],
};

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Prefer API-resolved list; fall back to role defaults. */
export function resolveUserPermissions(
  role: Role | null | undefined,
  permissions?: readonly string[] | null,
): readonly Permission[] {
  if (permissions && permissions.length > 0) {
    return permissions as Permission[];
  }
  if (!role) return [];
  return getPermissionsForRole(role);
}

export function hasPermission(
  role: Role | null | undefined,
  permission: Permission,
  permissions?: readonly string[] | null,
): boolean {
  return resolveUserPermissions(role, permissions).includes(permission);
}

export function hasAnyPermission(
  role: Role | null | undefined,
  needed: Permission[],
  permissions?: readonly string[] | null,
): boolean {
  return needed.some((permission) => hasPermission(role, permission, permissions));
}
