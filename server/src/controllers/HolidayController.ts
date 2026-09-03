import type { Request, Response } from 'express';
import type {
  CreateHolidayDto,
  ListHolidaysQueryDto,
  UpdateHolidayDto,
} from '../dto/holiday.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HolidayService } from '../services/HolidayService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class HolidayController {
  private static instance: HolidayController | null = null;
  private constructor(private readonly holidays = HolidayService.getInstance()) {}
  public static getInstance(): HolidayController {
    if (!HolidayController.instance) HolidayController.instance = new HolidayController();
    return HolidayController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListHolidaysQueryDto;
    const rows = await this.holidays.list(query);
    ApiResponse.success(res, rows, 'Holidays');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.holidays.create(req.body as CreateHolidayDto, req.user);
    ApiResponse.success(res, row, 'Holiday added', HttpStatus.CREATED);
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.holidays.update(
      Number(req.params.id),
      req.body as UpdateHolidayDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Holiday updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    await this.holidays.remove(Number(req.params.id), req.user);
    ApiResponse.success(res, null, 'Holiday removed');
  };
}
