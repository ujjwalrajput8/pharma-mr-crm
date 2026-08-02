import type { ListAuditLogsQueryDto } from '../dto/audit.dto';
import {
  AuditLogRepository,
  type CreateAuditLogInput,
} from '../repositories/AuditLogRepository';

/**
 * AuditService — write and query audit trail entries.
 * Design Pattern: Singleton + Service Layer
 */
export class AuditService {
  private static instance: AuditService | null = null;

  private constructor(private readonly audits = AuditLogRepository.getInstance()) {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public async log(input: CreateAuditLogInput): Promise<void> {
    await this.audits.create(input);
  }

  public async list(query: ListAuditLogsQueryDto) {
    const { items, total } = await this.audits.list({
      page: query.page,
      limit: query.limit,
      entity: query.entity,
      action: query.action,
      userId: query.userId,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        entity: item.entity,
        entityId: item.entityId,
        metadata: item.metadata,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        createdAt: item.createdAt.toISOString(),
        user: item.user
          ? {
              id: item.user.id,
              fullName: item.user.fullName,
              email: item.user.email,
              role: item.user.role,
            }
          : null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
}
