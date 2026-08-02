import type { Request, Response } from 'express';
import { VisitService } from '../services/VisitService';
import { ApiResponse } from '../utils/ApiResponse';
import type { ListVisitsQueryDto } from '../dto/visit.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class VisitController {
  private static instance: VisitController | null = null;

  private constructor(private readonly visits = VisitService.getInstance()) {}

  public static getInstance(): VisitController {
    if (!VisitController.instance) {
      VisitController.instance = new VisitController();
    }
    return VisitController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const query = (req.validatedQuery ?? req.query) as ListVisitsQueryDto;
    const result = await this.visits.list(query, actor);
    ApiResponse.success(res, result.items, 'Visits retrieved', HttpStatus.OK, result.meta);
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    await this.visits.remove(String(req.params.id), actor);
    ApiResponse.success(res, null, 'Visit deleted');
  };

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
