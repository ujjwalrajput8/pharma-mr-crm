import type { Request, Response } from 'express';
import type {
  ListTargetsQueryDto,
  TargetProgressQueryDto,
  UpsertTargetDto,
} from '../dto/target.dto';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import { TargetService } from '../services/TargetService';
import { ApiResponse } from '../utils/ApiResponse';

export class TargetController {
  private static instance: TargetController | null = null;
  private constructor(private readonly targets = TargetService.getInstance()) {}
  public static getInstance(): TargetController {
    if (!TargetController.instance) TargetController.instance = new TargetController();
    return TargetController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListTargetsQueryDto;
    const items = await this.targets.list(query, req.user);
    ApiResponse.success(res, items, 'Targets retrieved');
  };

  public upsert = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const target = await this.targets.upsert(req.body as UpsertTargetDto, req.user);
    ApiResponse.created(res, target, 'Target saved');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const raw = req.params.id;
    const id = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('Invalid id');
    await this.targets.remove(id, req.user);
    ApiResponse.noContent(res);
  };

  public progress = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as TargetProgressQueryDto;
    const result = await this.targets.progress(query, req.user);
    ApiResponse.success(res, result, 'Target progress retrieved');
  };
}
