import type { Request, Response } from 'express';
import type { ListSettingsQueryDto, UpsertSettingDto } from '../dto/setting.dto';
import { UnauthorizedError } from '../errors/AppError';
import { SettingService } from '../services/SettingService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class SettingController {
  private static instance: SettingController | null = null;

  private constructor(private readonly settings = SettingService.getInstance()) {}

  public static getInstance(): SettingController {
    if (!SettingController.instance) {
      SettingController.instance = new SettingController();
    }
    return SettingController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListSettingsQueryDto;
    const items = await this.settings.list(query);
    ApiResponse.success(res, items, 'Settings retrieved', HttpStatus.OK);
  };

  public upsert = async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new UnauthorizedError('Authentication required');
    const item = await this.settings.upsert(req.body as UpsertSettingDto, req.user.id);
    ApiResponse.success(res, item, 'Setting saved');
  };
}
