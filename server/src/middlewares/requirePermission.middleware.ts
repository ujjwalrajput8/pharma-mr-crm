import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey } from '../constants/permissions';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * requirePermission
 * Permission gate — passes when the caller holds ANY of the listed keys, matching the
 * "any-of" semantics the sidebar and route guards use on the client.
 *
 * `authorize()` only checks the role, so an Admin who revokes a Manager's `stock:manage`
 * used to change nothing on the API. This closes that gap: effective permissions are
 * resolved per request in `authenticate`, so a revoke takes effect immediately.
 */
export function requirePermission(...anyOf: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const granted = req.user.permissions ?? [];
    if (anyOf.length === 0 || anyOf.some((key) => granted.includes(key))) {
      next();
      return;
    }

    next(
      new ForbiddenError(
        'You do not have permission for this action. Ask an administrator to grant access.',
      ),
    );
  };
}
