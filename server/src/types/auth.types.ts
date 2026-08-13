import type { AppRole } from '../constants';

/**
 * Authenticated user context attached to Express requests after JWT verification.
 * IDs are SQL autoincrement integers.
 */
export interface AuthUser {
  id: number;
  email: string;
  role: AppRole;
  fullName: string;
}

export interface AccessTokenPayload {
  sub: string; // stringified numeric user id (JWT standard)
  email: string;
  role: AppRole;
  fullName: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginResult {
  user: {
    id: number;
    email: string;
    fullName: string;
    role: AppRole;
    status: string;
    permissions: string[];
  };
  tokens: TokenPair;
}
