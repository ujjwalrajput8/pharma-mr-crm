import type { AppRole } from '../constants';

/**
 * Authenticated user context attached to Express requests after JWT verification.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
}

export interface AccessTokenPayload {
  sub: string;
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
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
    status: string;
  };
  tokens: TokenPair;
}
