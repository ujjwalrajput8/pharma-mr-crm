import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { HttpStatus } from '../constants';
import { ApiResponse } from '../utils/ApiResponse';
import { Logger } from '../utils/logger';

/**
 * errorMiddleware
 * Centralized Express error handler.
 * Design Pattern: Chain of Responsibility (terminal middleware)
 * SOLID:
 *  - SRP: Maps thrown errors → HTTP responses
 *  - OCP: New error types handled without changing controllers
 *  - DIP: Depends on AppError abstraction
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const logger = Logger.getInstance();

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(err, { code: err.code });
    } else {
      logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    }

    ApiResponse.error(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  if (err instanceof ZodError) {
    ApiResponse.error(
      res,
      'Validation failed',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      err.flatten(),
    );
    return;
  }

  logger.error(err instanceof Error ? err : String(err));
  ApiResponse.error(
    res,
    'Internal Server Error',
    HttpStatus.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
  );
}
