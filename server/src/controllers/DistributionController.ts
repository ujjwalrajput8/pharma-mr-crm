import type { Request, Response } from 'express';
import type { ListDistributionsQueryDto } from '../dto/distribution.dto';
import { UnauthorizedError } from '../errors/AppError';
import { DistributionService } from '../services/DistributionService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class DistributionController {
  private static instance: DistributionController | null = null;

  private constructor(private readonly distributions = DistributionService.getInstance()) {}

  public static getInstance(): DistributionController {
    if (!DistributionController.instance) {
      DistributionController.instance = new DistributionController();
    }
    return DistributionController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListDistributionsQueryDto;
    const result = await this.distributions.list(query, req.user);
    ApiResponse.success(res, result.items, 'Distributions retrieved', HttpStatus.OK, result.meta);
  };
}
