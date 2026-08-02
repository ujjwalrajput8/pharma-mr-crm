import type { Request, Response } from 'express';
import { StoreService } from '../services/StoreService';
import { ApiResponse } from '../utils/ApiResponse';
import type { CreateStoreDto, ListStoresQueryDto, UpdateStoreDto } from '../dto/store.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class StoreController {
  private static instance: StoreController | null = null;

  private constructor(private readonly stores = StoreService.getInstance()) {}

  public static getInstance(): StoreController {
    if (!StoreController.instance) {
      StoreController.instance = new StoreController();
    }
    return StoreController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListStoresQueryDto;
    const result = await this.stores.list(query);
    ApiResponse.success(res, result.items, 'Stores retrieved', HttpStatus.OK, result.meta);
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const store = await this.stores.getById(String(req.params.id));
    ApiResponse.success(res, store, 'Store retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const store = await this.stores.create(req.body as CreateStoreDto, this.requireActor(req));
    ApiResponse.created(res, store, 'Store created');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const store = await this.stores.update(
      String(req.params.id),
      req.body as UpdateStoreDto,
      this.requireActor(req),
    );
    ApiResponse.success(res, store, 'Store updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    await this.stores.remove(String(req.params.id), this.requireActor(req));
    ApiResponse.success(res, null, 'Store deleted');
  };

  private requireActor(req: Request): string {
    if (!req.user?.id) throw new UnauthorizedError('Authentication required');
    return req.user.id;
  }
}
