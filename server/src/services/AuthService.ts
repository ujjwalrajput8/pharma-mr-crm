import type { Request } from 'express';
import { Config } from '../config';
import { UserStatuses, type AppRole } from '../constants';
import type { LoginDto } from '../dto/auth.dto';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser, LoginResult } from '../types/auth.types';
import { AuditService } from './AuditService';
import { PasswordService } from './PasswordService';
import { PermissionService } from './PermissionService';
import { TokenService } from './TokenService';

/**
 * AuthService
 * Business logic for login, refresh, logout, and current-user.
 * Design Pattern: Service Layer
 * SOLID: SRP, DIP
 */
export class AuthService {
  private static instance: AuthService | null = null;

  private constructor(
    private readonly users = UserRepository.getInstance(),
    private readonly refreshTokens = RefreshTokenRepository.getInstance(),
    private readonly passwords = PasswordService.getInstance(),
    private readonly tokens = TokenService.getInstance(),
    private readonly audits = AuditService.getInstance(),
    private readonly permissions = PermissionService.getInstance(),
    private readonly config = Config.getInstance(),
  ) {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== UserStatuses.ACTIVE) {
      throw new ForbiddenError('Account is inactive. Contact an administrator.');
    }

    const valid = await this.passwords.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const authUser = this.toAuthUser(user.id, user.email, user.role, user.fullName);
    const tokens = await this.issueSession(authUser, meta);
    await this.users.update(user.id, { lastLoginAt: new Date() });
    const permissions = await this.permissions.resolveForUser(user.id);

    try {
      await this.audits.log({
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: String(user.id),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    } catch {
      // Audit must not block authentication
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as AppRole,
        status: user.status,
        permissions,
      },
      tokens,
    };
  }

  public async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<LoginResult> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);
    const tokenHash = this.tokens.hashToken(refreshToken);
    const stored = await this.refreshTokens.findValidByHash(tokenHash);
    const userId = Number(payload.sub);

    if (
      !stored ||
      stored.jti !== payload.jti ||
      stored.userId !== userId ||
      Number.isNaN(userId)
    ) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.users.findById(userId);
    if (!user || user.status !== UserStatuses.ACTIVE) {
      throw new ForbiddenError('Account is inactive or not found');
    }

    await this.refreshTokens.revoke(stored.id);

    const authUser = this.toAuthUser(user.id, user.email, user.role, user.fullName);
    const tokens = await this.issueSession(authUser, meta);
    const permissions = await this.permissions.resolveForUser(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as AppRole,
        status: user.status,
        permissions,
      },
      tokens,
    };
  }

  public async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = this.tokens.verifyRefreshToken(refreshToken);
      const stored = await this.refreshTokens.findValidByHash(
        this.tokens.hashToken(refreshToken),
      );
      if (stored && stored.jti === payload.jti) {
        await this.refreshTokens.revoke(stored.id);
      }
    } catch {
      // Idempotent logout
    }
  }

  public async me(userId: number): Promise<LoginResult['user']> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== UserStatuses.ACTIVE) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const permissions = await this.permissions.resolveForUser(user.id);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AppRole,
      status: user.status,
      permissions,
    };
  }

  public extractBearerToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice(7).trim() || undefined;
  }

  private toAuthUser(
    id: number,
    email: string,
    role: string,
    fullName: string,
  ): AuthUser {
    return {
      id,
      email,
      role: role as AppRole,
      fullName,
    };
  }

  private async issueSession(
    authUser: AuthUser,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const jti = this.tokens.generateJti();
    const tokenPair = this.tokens.createTokenPair(authUser, jti);

    await this.refreshTokens.create({
      jti,
      tokenHash: this.tokens.hashToken(tokenPair.refreshToken),
      expiresAt: this.resolveRefreshExpiry(),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      user: { connect: { id: authUser.id } },
    });

    return tokenPair;
  }

  private resolveRefreshExpiry(): Date {
    const expiresIn = this.config.jwtRefreshExpiresIn;
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    const now = Date.now();

    if (!match) {
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match[1]);
    const unit = match[2] ?? 'd';
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(now + amount * (multipliers[unit] ?? 86_400_000));
  }
}
