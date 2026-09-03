export type Role = 'ADMIN' | 'MANAGER' | 'MR';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus | string;
  /** Effective permissions from API (role defaults or Admin overrides). */
  permissions?: Permission[];
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface AuthSessionPayload {
  user: AuthUser;
  accessToken: string;
  expiresIn: string;
}

export type Permission =
  | 'dashboard:view'
  | 'myday:own'
  | 'approvals:team'
  | 'users:manage'
  | 'doctors:manage'
  | 'doctors:own'
  | 'stores:manage'
  | 'medicines:manage'
  | 'batches:manage'
  | 'appointments:manage'
  | 'appointments:own'
  | 'visits:manage'
  | 'visits:own'
  | 'tour-plan:manage'
  | 'tour-plan:own'
  | 'distributions:manage'
  | 'distributions:own'
  | 'medicine-issues:manage'
  | 'medicine-issues:own'
  | 'stock:manage'
  | 'ledger:view'
  | 'mystock:own'
  | 'reports:all'
  | 'reports:own'
  | 'sales:manage'
  | 'sales:own'
  | 'attendance:own'
  | 'attendance:manage'
  | 'leaves:own'
  | 'leaves:manage'
  | 'employees:view'
  | 'holidays:manage'
  | 'leave-types:manage'
  | 'settings:manage'
  | 'audit:view'
  | 'profile:own';
