import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/AppError';

type RequestPart = 'body' | 'query' | 'params';

declare module 'express-serve-static-core' {
  interface Request {
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}

/**
 * validateRequest
 * Factory that produces Express middleware validating a request part with Zod.
 * Express 5 note: `req.query` / `req.params` are read-only getters — validated
 * values are attached as `validatedQuery` / `validatedParams` instead.
 */
export function validateRequest<T>(schema: ZodType<T>, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten()));
      return;
    }

    if (part === 'body') {
      req.body = result.data;
    } else if (part === 'query') {
      req.validatedQuery = result.data;
    } else {
      req.validatedParams = result.data;
    }

    next();
  };
}
