import type { Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { MyDayService } from '../services/MyDayService';
import { ApiResponse } from '../utils/ApiResponse';

export class MyDayController {
  private static instance: MyDayController | null = null;
  private constructor(private readonly myDay = MyDayService.getInstance()) {}
  public static getInstance(): MyDayController {
    if (!MyDayController.instance) MyDayController.instance = new MyDayController();
    return MyDayController.instance;
  }

  public snapshot = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data = await this.myDay.snapshot(req.user);
    ApiResponse.success(res, data, 'My day');
  };
}
