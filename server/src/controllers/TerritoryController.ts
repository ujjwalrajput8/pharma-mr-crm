import type { Request, Response } from 'express';
import type {
  CreateTerritoryDto,
  ListTerritoriesQueryDto,
  UpdateTerritoryDto,
} from '../dto/territory.dto';
import { UnauthorizedError } from '../errors/AppError';
import { TerritoryService } from '../services/TerritoryService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class TerritoryController {
  private static instance: TerritoryController | null = null;
  private constructor(private readonly territories = TerritoryService.getInstance()) {}
  public static getInstance(): TerritoryController {
    if (!TerritoryController.instance) TerritoryController.instance = new TerritoryController();
    return TerritoryController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListTerritoriesQueryDto;
    const rows = await this.territories.list(query);
    ApiResponse.success(res, rows, 'Territories');
  };

  public tree = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const includeInactive = req.query.includeInactive === 'true';
    const roots = await this.territories.tree(includeInactive);
    ApiResponse.success(res, roots, 'Territory tree');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.territories.create(req.body as CreateTerritoryDto, req.user);
    ApiResponse.success(res, row, 'Territory created', HttpStatus.CREATED);
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.territories.update(
      Number(req.params.id),
      req.body as UpdateTerritoryDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Territory updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    await this.territories.remove(Number(req.params.id), req.user);
    ApiResponse.success(res, null, 'Territory deleted');
  };
}
