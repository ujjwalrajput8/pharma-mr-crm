import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export interface CreateAuditLogInput {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Values before / after a change, and why — used for corrections. */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * AuditLogRepository — append-only security/change history.
 * Design Pattern: Repository + Singleton
 */
export class AuditLogRepository {
  private static instance: AuditLogRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): AuditLogRepository {
    if (!AuditLogRepository.instance) {
      AuditLogRepository.instance = new AuditLogRepository();
    }
    return AuditLogRepository.instance;
  }

  /** Pass the transaction client when the entry must commit (or roll back) with the change. */
  public create(data: CreateAuditLogInput, client: AuditClient = this.prisma) {
    return client.auditLog.create({
      data: {
        userId: data.userId ?? undefined,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? undefined,
        metadata: data.metadata,
        before: data.before,
        after: data.after,
        reason: data.reason ?? undefined,
        ipAddress: data.ipAddress ?? undefined,
        userAgent: data.userAgent ?? undefined,
      },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    entity?: string;
    action?: string;
    userId?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
