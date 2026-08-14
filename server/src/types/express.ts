import type { AuthUser } from './auth.types';

/**
 * Augments Express Request with JWT auth context set by authenticate middleware.
 * Kept as a .ts module (not a declaration file) so gitignore cannot drop it from deploys.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export {};
