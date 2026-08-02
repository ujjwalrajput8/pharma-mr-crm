import type { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Config } from '../config';
import { UnauthorizedError } from '../errors/AppError';
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
  TokenPair,
} from '../types/auth.types';
import { TOKEN_TYPES } from '../constants';

/**
 * TokenService
 * Issues and verifies JWT access/refresh tokens.
 * Design Pattern: Singleton + Strategy (access vs refresh)
 * SOLID: SRP
 */
export class TokenService {
  private static instance: TokenService | null = null;
  private readonly config: Config;

  private constructor() {
    this.config = Config.getInstance();
  }

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public createAccessToken(user: AuthUser): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      type: TOKEN_TYPES.ACCESS,
    };

    const options: SignOptions = {
      expiresIn: this.config.jwtAccessExpiresIn as SignOptions['expiresIn'],
    };

    return jwt.sign(payload, this.config.jwtAccessSecret, options);
  }

  public createRefreshToken(userId: string, jti: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: TOKEN_TYPES.REFRESH,
      jti,
    };

    const options: SignOptions = {
      expiresIn: this.config.jwtRefreshExpiresIn as SignOptions['expiresIn'],
    };

    return jwt.sign(payload, this.config.jwtRefreshSecret, options);
  }

  public createTokenPair(user: AuthUser, jti: string): TokenPair {
    return {
      accessToken: this.createAccessToken(user),
      refreshToken: this.createRefreshToken(user.id, jti),
      expiresIn: this.config.jwtAccessExpiresIn,
    };
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.config.jwtAccessSecret) as AccessTokenPayload;
      if (payload.type !== TOKEN_TYPES.ACCESS) {
        throw new UnauthorizedError('Invalid access token');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  public verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, this.config.jwtRefreshSecret) as RefreshTokenPayload;
      if (payload.type !== TOKEN_TYPES.REFRESH) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  public generateJti(): string {
    return crypto.randomUUID();
  }
}
