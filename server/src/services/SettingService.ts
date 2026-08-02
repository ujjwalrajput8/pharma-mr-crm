import type { ListSettingsQueryDto, UpsertSettingDto } from '../dto/setting.dto';
import { SettingRepository } from '../repositories/SettingRepository';

/**
 * SettingService — organization configuration key/values.
 * Design Pattern: Singleton + Service Layer
 */
export class SettingService {
  private static instance: SettingService | null = null;

  private constructor(private readonly settings = SettingRepository.getInstance()) {}

  public static getInstance(): SettingService {
    if (!SettingService.instance) {
      SettingService.instance = new SettingService();
    }
    return SettingService.instance;
  }

  public async list(query: ListSettingsQueryDto) {
    const items = await this.settings.list(query.group);
    return items.map((item) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      group: item.group,
      updatedAt: item.updatedAt,
    }));
  }

  public async upsert(dto: UpsertSettingDto, actorId: number) {
    const item = await this.settings.upsert({
      key: dto.key,
      value: dto.value,
      group: dto.group,
      actorId,
    });
    return {
      id: item.id,
      key: item.key,
      value: item.value,
      group: item.group,
      updatedAt: item.updatedAt,
    };
  }
}
