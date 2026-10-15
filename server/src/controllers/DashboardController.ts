import type { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { ApiResponse } from '../utils/ApiResponse';
import { UnauthorizedError } from '../errors/AppError';

export class DashboardController {
  private static instance: DashboardController | null = null;

  private constructor(private readonly dashboard = DashboardService.getInstance()) {}

  public static getInstance(): DashboardController {
    if (!DashboardController.instance) {
      DashboardController.instance = new DashboardController();
    }
    return DashboardController.instance;
  }

  public summary = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data = await this.dashboard.getSummary(req.user);
    ApiResponse.success(res, data, 'Dashboard summary');
  };

  public trends = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as { days?: number };
    const data = await this.dashboard.getTrends(req.user, query.days ?? 30);
    ApiResponse.success(res, data, 'Dashboard trends');
  };
}
