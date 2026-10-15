import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export interface CreateNotificationInput {
  userId: number;
  kind: string;
  title: string;
  message: string;
  href?: string | null;
  tone?: string;
}

/**
 * NotificationRepository — persistent bell items (read/unread survives reloads).
 * Design Pattern: Repository + Singleton
 */
export class NotificationRepository {
  private static instance: NotificationRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): NotificationRepository {
    if (!NotificationRepository.instance) {
      NotificationRepository.instance = new NotificationRepository();
    }
    return NotificationRepository.instance;
  }

  public create(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title.slice(0, 200),
        message: input.message.slice(0, 500),
        href: input.href ?? null,
        tone: input.tone ?? 'neutral',
      },
    });
  }

  public listForUser(userId: number, limit = 20): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  public findById(id: number): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id } });
  }

  public markRead(id: number): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  public markAllRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
