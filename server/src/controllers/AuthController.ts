import type { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiResponse } from '../utils/ApiResponse';
import type { LoginDto } from '../dto/auth.dto';
import { BadRequestError } from '../errors/AppError';

const REFRESH_COOKIE = 'refreshToken';

/**
 * AuthController
 * Thin HTTP adapter for authentication endpoints.
 * Design Pattern: Controller Layer
 * SOLID: SRP — maps HTTP ↔ AuthService only
 */
export class AuthController {
  private static instance: AuthController | null = null;

  private constructor(private readonly authService = AuthService.getInstance()) {}

  public static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController();
    }
    return AuthController.instance;
  }

  public login = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as LoginDto;
    const result = await this.authService.login(dto, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });

    this.setRefreshCookie(res, result.tokens.refreshToken);

    ApiResponse.success(
      res,
      {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
      'Login successful',
    );
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const bodyToken =
      typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
    const cookieToken =
      typeof req.cookies?.[REFRESH_COOKIE] === 'string'
        ? (req.cookies[REFRESH_COOKIE] as string)
        : undefined;
    const refreshToken = bodyToken ?? cookieToken;

    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    const result = await this.authService.refresh(refreshToken, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });

    this.setRefreshCookie(res, result.tokens.refreshToken);

    ApiResponse.success(
      res,
      {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
      'Token refreshed',
    );
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const bodyToken =
      typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
    const cookieToken =
      typeof req.cookies?.[REFRESH_COOKIE] === 'string'
        ? (req.cookies[REFRESH_COOKIE] as string)
        : undefined;

    await this.authService.logout(bodyToken ?? cookieToken);
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/api/v1/auth' });
    ApiResponse.success(res, null, 'Logged out');
  };

  public me = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestError('Authenticated user required');
    }

    const user = await this.authService.me(userId);
    ApiResponse.success(res, { user }, 'Current user');
  };

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
