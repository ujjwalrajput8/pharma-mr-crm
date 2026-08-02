import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/AppError';

/**
 * notFoundMiddleware
 * Catch-all for unmatched routes. Throws NotFoundError for the error middleware.
 * Design Pattern: Chain of Responsibility
 */
export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('Route not found'));
}
