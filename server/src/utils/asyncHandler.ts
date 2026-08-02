import type { NextFunction, Request, Response } from 'express';

/**
 * asyncHandler
 * Adapter that wraps async route handlers so rejected promises
 * are forwarded to the centralized error middleware.
 * Design Pattern: Adapter / Higher-Order Function
 * SOLID: DIP — controllers stay free of try/catch boilerplate
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
