import type { Prisma, RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

/**
 * RefreshTokenRepository
 * Persists hashed refresh tokens for rotation and revocation.
 * Design Pattern: Repository
 */
export class RefreshTokenRepository {
  private static instance: RefreshTokenRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): RefreshTokenRepository {
    if (!RefreshTokenRepository.instance) {
      RefreshTokenRepository.instance = new RefreshTokenRepository();
    }
    return RefreshTokenRepository.instance;
  }

  public create(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  public findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  public revoke(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  public revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
