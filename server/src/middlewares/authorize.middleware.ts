import type { NextFunction, Request, Response } from 'express';
import type { AppRole } from '../constants';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * authorize
 * RBAC middleware factory — allows only the listed roles.
 * Design Pattern: Factory + Strategy (role gate)
 * SOLID: OCP (new roles via args), SRP (authorization only)
 */
export function authorize(...allowedRoles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}
