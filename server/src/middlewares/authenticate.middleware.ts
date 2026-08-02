import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { AuthService } from '../services/AuthService';
import { TokenService } from '../services/TokenService';
import { UserStatuses, type AppRole } from '../constants';
import { UserRepository } from '../repositories/UserRepository';

/**
 * authenticate
 * JWT Bearer authentication middleware.
 * Design Pattern: Middleware / Chain of Responsibility
 * SOLID: SRP — authentication only (authorization is separate)
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authService = AuthService.getInstance();
    const token = authService.extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = TokenService.getInstance().verifyAccessToken(token);
    const user = await UserRepository.getInstance().findById(payload.sub);

    if (!user || user.status !== UserStatuses.ACTIVE || user.deletedAt) {
      throw new UnauthorizedError('User not found or inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as AppRole,
      fullName: user.fullName,
    };

    next();
  } catch (error) {
    next(error);
  }
}
