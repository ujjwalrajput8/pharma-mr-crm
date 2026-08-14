import type { Prisma, Setting } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';

/**
 * SettingRepository — key/value application settings.
 * Design Pattern: Repository + Singleton
 */
export class SettingRepository {
  private static instance: SettingRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): SettingRepository {
    if (!SettingRepository.instance) {
      SettingRepository.instance = new SettingRepository();
    }
    return SettingRepository.instance;
  }

  public list(group?: string): Promise<Setting[]> {
    const where: Prisma.SettingWhereInput = {
      deletedAt: null,
      ...(group ? { group } : {}),
    };
    return this.prisma.setting.findMany({
      where,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  public findByKey(key: string): Promise<Setting | null> {
    return this.prisma.setting.findFirst({
      where: { key, deletedAt: null },
    });
  }

  public upsert(params: {
    key: string;
    value: string;
    group: string;
    actorId: number;
  }): Promise<Setting> {
    return this.prisma.setting.upsert({
      where: { key: params.key },
      create: {
        key: params.key,
        value: params.value,
        group: params.group,
        createdBy: params.actorId,
        updatedBy: params.actorId,
      },
      update: {
        value: params.value,
        group: params.group,
        updatedBy: params.actorId,
        deletedAt: null,
      },
    });
  }
}
