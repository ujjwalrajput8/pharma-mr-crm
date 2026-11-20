import type { Request, Response } from 'express';
import { StoreAssignmentService } from '../services/StoreAssignmentService';
import { StoreService } from '../services/StoreService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  AssignStoresDto,
  CreateStoreDto,
  ListStoresQueryDto,
  MyStoresQueryDto,
  UpdateStoreDto,
} from '../dto/store.dto';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import type { AuthUser } from '../types/auth.types';
import { HttpStatus } from '../constants';

export class StoreController {
  private static instance: StoreController | null = null;

  private constructor(
    private readonly stores = StoreService.getInstance(),
    private readonly assignments = StoreAssignmentService.getInstance(),
  ) {}

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
    const store = await this.stores.getById(Number(req.params.id));
    ApiResponse.success(res, store, 'Store retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const store = await this.stores.create(req.body as CreateStoreDto, this.requireActor(req));
    ApiResponse.created(res, store, 'Store created');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const store = await this.stores.update(
      Number(req.params.id),
      req.body as UpdateStoreDto,
      this.requireActor(req),
    );
    ApiResponse.success(res, store, 'Store updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    await this.stores.remove(Number(req.params.id), this.requireActor(req));
    ApiResponse.success(res, null, 'Store deleted');
  };

  public mine = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as MyStoresQueryDto;
    ApiResponse.success(res, await this.assignments.mine(this.requireUser(req), query.type), 'My chemists / stockists');
  };

  public assignMr = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AssignStoresDto;
    const result = await this.assignments.assign({ ...body, actor: this.requireUser(req) });
    ApiResponse.success(res, { ...result, stores: body.storeIds.length }, 'Assignment saved');
  };

  public assignmentHistory = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new BadRequestError('Invalid store id');
    await this.stores.getById(id);
    ApiResponse.success(res, await this.assignments.history(id), 'Assignment history');
  };

  private requireUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }

  private requireActor(req: Request): number {
    if (!req.user?.id) throw new UnauthorizedError('Authentication required');
    return req.user.id;
  }
}
