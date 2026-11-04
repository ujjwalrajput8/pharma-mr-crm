import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { HttpStatus, type HttpStatusCode } from '../constants';
import { ApiResponse } from '../utils/ApiResponse';
import { Logger } from '../utils/logger';

type Mapped = { status: HttpStatusCode; code: string; message: string };

/** Unique-constraint fields, wherever this Prisma version / driver adapter puts them. */
function conflictFields(err: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = (err.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
  };
  const fields = meta.target ?? meta.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) return fields.map(String);
  return typeof fields === 'string' ? [fields] : [];
}

/**
 * Database errors that are really bad input or a clash — answered as 4xx
 * instead of a bare 500, so the screen can tell the user what to fix.
 */
function mapKnownError(err: unknown): Mapped | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = conflictFields(err);
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: fields.length
          ? `A record with the same ${fields.join(' + ')} already exists`
          : 'This record already exists',
      };
    }
    if (err.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Record not found' };
    }
    if (err.code === 'P2003') {
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'This refers to a record that does not exist or is still in use',
      };
    }
    return null;
  }
  // A malformed value reached the query (e.g. a non-numeric id in the URL).
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: HttpStatus.BAD_REQUEST, code: 'INVALID_INPUT', message: 'Some of the data sent is not valid' };
  }
  // Plain errors thrown by the stock ledger.
  if (err instanceof Error) {
    if (err.message === 'INSUFFICIENT_STOCK') {
      return { status: HttpStatus.CONFLICT, code: 'INSUFFICIENT_STOCK', message: 'Not enough stock for this quantity' };
    }
    if (err.message === 'INVALID_QTY') {
      return { status: HttpStatus.BAD_REQUEST, code: 'INVALID_QTY', message: 'Quantity must be more than zero' };
    }
    if (err.message === 'STOCK_NOT_FOUND') {
      return { status: HttpStatus.NOT_FOUND, code: 'STOCK_NOT_FOUND', message: 'No stock found for this medicine' };
    }
  }
  return null;
}

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

  const mapped = mapKnownError(err);
  if (mapped) {
    // Kept at error level: a 4xx here can still point at a client or server bug.
    logger.error(err instanceof Error ? err : String(err), { code: mapped.code });
    ApiResponse.error(res, mapped.message, mapped.status, mapped.code);
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
