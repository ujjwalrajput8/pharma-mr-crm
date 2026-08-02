import type { Request, Response } from 'express';
import type { ReportQueryDto } from '../dto/report.dto';
import { UnauthorizedError } from '../errors/AppError';
import { ReportService } from '../services/ReportService';
import { ApiResponse } from '../utils/ApiResponse';

export class ReportController {
  private static instance: ReportController | null = null;

  private constructor(private readonly reports = ReportService.getInstance()) {}

  public static getInstance(): ReportController {
    if (!ReportController.instance) {
      ReportController.instance = new ReportController();
    }
    return ReportController.instance;
  }

  public get = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ReportQueryDto;
    const data = await this.reports.getReport(query, req.user);
    ApiResponse.success(res, data, 'Report generated');
  };
}
