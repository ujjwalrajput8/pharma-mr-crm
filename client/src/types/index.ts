export type Role = 'ADMIN' | 'MR';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus | string;
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
  | 'users:manage'
  | 'doctors:manage'
  | 'doctors:own'
  | 'stores:manage'
  | 'medicines:manage'
  | 'appointments:manage'
  | 'appointments:own'
  | 'visits:manage'
  | 'visits:own'
  | 'distributions:manage'
  | 'distributions:own'
  | 'stock:manage'
  | 'reports:all'
  | 'reports:own'
  | 'settings:manage'
  | 'audit:view'
  | 'profile:own';
