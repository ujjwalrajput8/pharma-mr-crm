import type { Response } from 'express';
import { HttpStatus, type HttpStatusCode } from '../constants';

/**
 * ApiResponse
 * Standardized success envelope for all controllers.
 * Design Pattern: Builder-style static helpers (consistent payload shape).
 * SOLID:
 *  - SRP: Response formatting only
 *  - DRY: Controllers reuse one envelope
 *  - OCP: New helpers can be added without changing callers
 */
export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export class ApiResponse {
  public static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode: HttpStatusCode = HttpStatus.OK,
    meta?: Record<string, unknown>,
  ): Response {
    const body: ApiSuccessBody<T> = {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    };
    return res.status(statusCode).json(body);
  }

  public static created<T>(res: Response, data: T, message = 'Created'): Response {
    return ApiResponse.success(res, data, message, HttpStatus.CREATED);
  }

  public static noContent(res: Response): Response {
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  public static error(
    res: Response,
    message: string,
    statusCode: HttpStatusCode,
    code: string,
    details?: unknown,
  ): Response {
    const body: ApiErrorBody = {
      success: false,
      message,
      code,
      ...(details !== undefined ? { details } : {}),
    };
    return res.status(statusCode).json(body);
  }
}
