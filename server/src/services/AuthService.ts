import crypto from 'crypto';
import type { Request } from 'express';
import { Config } from '../config';
import { UserStatuses, type AppRole } from '../constants';
import type { LoginDto, ResetPasswordDto, ResetRequestDto } from '../dto/auth.dto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser, LoginResult } from '../types/auth.types';
import { AuditService } from './AuditService';
import { PasswordService } from './PasswordService';
import { PermissionService } from './PermissionService';
import { TokenService } from './TokenService';

const MAX_FAILED_LOGINS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 60;

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
    private readonly prisma = PrismaService.getClient(),
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

    // Temporary lockout — checked BEFORE the password so the response never
    // reveals whether the password would have been right.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
      );
      throw new TooManyRequestsError(
        `Account locked, try again in ${minutesLeft} min`,
      );
    }

    const valid = await this.passwords.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.registerFailedLogin(user.id, user.failedLoginCount, meta);
      throw new UnauthorizedError('Invalid email or password');
    }

    const authUser = this.toAuthUser(user.id, user.email, user.role, user.fullName);
    const tokens = await this.issueSession(authUser, meta);
    await this.users.update(user.id, {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    });
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

  /**
   * Employee changes their own password. Every other session is revoked so a
   * stolen refresh token cannot outlive the change.
   */
  public async changePassword(
    userId: number,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    const matches = await this.passwords.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.users.update(userId, { passwordHash, updatedBy: userId });
    await this.refreshTokens.revokeAllForUser(userId);
  }

  /**
   * Admin generates a single-use reset link to hand over to the employee
   * (no SMTP in this deployment). Only the SHA-256 of the token is stored.
   */
  public async createResetRequest(
    dto: ResetRequestDto,
    actor: AuthUser,
  ): Promise<{ resetUrl: string; expiresAt: string }> {
    const user = await this.users.findById(dto.userId);
    if (!user || user.deletedAt) throw new NotFoundError('User not found');
    if (user.status !== UserStatuses.ACTIVE) {
      throw new BadRequestError('Cannot reset the password of an inactive account');
    }

    const token = crypto.randomBytes(24).toString('hex'); // 48 hex chars
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt, createdBy: actor.id },
    });

    try {
      await this.audits.log({
        userId: actor.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: String(user.id),
        metadata: { email: user.email, expiresAt: expiresAt.toISOString() },
      });
    } catch {
      // Audit must not block the reset.
    }

    const base =
      this.config.getString('CLIENT_URL', '').trim().replace(/\/$/, '') ||
      this.config.corsOrigins[0] ||
      'http://localhost:5173';

    return {
      resetUrl: `${base}/reset-password?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Public: redeem a reset link. Every session of the user is revoked. */
  public async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row) {
      throw new BadRequestError('This reset link is invalid or has expired');
    }

    const user = await this.users.findById(row.userId);
    if (!user || user.status !== UserStatuses.ACTIVE) {
      throw new BadRequestError('This reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.users.update(user.id, {
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    await this.prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    // A stolen refresh token must not outlive the reset.
    await this.refreshTokens.revokeAllForUser(user.id);

    try {
      await this.audits.log({
        userId: user.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: String(user.id),
      });
    } catch {
      // Audit must not block the reset.
    }
  }

  /** Counts a wrong password; the 5th in a row locks the account for a while. */
  private async registerFailedLogin(
    userId: number,
    currentCount: number,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<void> {
    const failedLoginCount = currentCount + 1;
    if (failedLoginCount >= MAX_FAILED_LOGINS) {
      const lockoutMinutes = this.config.getNumber(
        'LOGIN_LOCKOUT_MINUTES',
        DEFAULT_LOCKOUT_MINUTES,
      );
      await this.users.update(userId, {
        failedLoginCount,
        lockedUntil: new Date(Date.now() + lockoutMinutes * 60_000),
      });
      try {
        await this.audits.log({
          userId,
          action: 'LOGIN_LOCKED',
          entity: 'User',
          entityId: String(userId),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: { failedLoginCount, lockoutMinutes },
        });
      } catch {
        // Audit must not block authentication.
      }
      return;
    }
    await this.users.update(userId, { failedLoginCount });
  }

  private toAuthUser(
    id: number,
    email: string,
    role: string,
    fullName: string,
    permissions: string[] = [],
  ): AuthUser {
    return {
      id,
      email,
      role: role as AppRole,
      fullName,
      permissions,
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
