import type { Permission, Role } from '@/types';

/**
 * Role → permission map (frontend mirror of backend RBAC).
 * Backend remains the source of truth for API access.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    'dashboard:view',
    'users:manage',
    'doctors:manage',
    'stores:manage',
    'medicines:manage',
    'appointments:manage',
    'visits:manage',
    'distributions:manage',
    'stock:manage',
    'reports:all',
    'settings:manage',
    'audit:view',
    'profile:own',
  ],
  MR: [
    'dashboard:view',
    'doctors:own',
    'appointments:own',
    'visits:own',
    'distributions:own',
    'reports:own',
    'profile:own',
  ],
};

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
