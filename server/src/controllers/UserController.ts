import type { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  CreateMrDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateMrDto,
} from '../dto/user.dto';
import { UnauthorizedError } from '../errors/AppError';
import { UserStatuses } from '../constants';

/**
 * UserController — Admin MR management endpoints (thin).
 */
export class UserController {
  private static instance: UserController | null = null;

  private constructor(private readonly users = UserService.getInstance()) {}

  public static getInstance(): UserController {
    if (!UserController.instance) {
      UserController.instance = new UserController();
    }
    return UserController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListUsersQueryDto;
    const result = await this.users.list(query);
    ApiResponse.success(res, result.items, 'Users retrieved', 200, result.meta);
  };

  /** Managers available as a reporting parent (for the create / edit form). */
  public managerOptions = async (_req: Request, res: Response): Promise<void> => {
    const rows = await this.users.listManagerOptions();
    ApiResponse.success(res, rows, 'Manager options');
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const user = await this.users.getById(Number(req.params.id));
    ApiResponse.success(res, user, 'User retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    const user = await this.users.createMr(req.body as CreateMrDto, actorId);
    ApiResponse.created(res, user, `${user.role === 'MANAGER' ? 'Manager' : 'MR'} account created`);
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    const user = await this.users.updateMr(Number(req.params.id), req.body as UpdateMrDto, actorId);
    ApiResponse.success(res, user, 'MR account updated');
  };

  public activate = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    const user = await this.users.setStatus(Number(req.params.id), UserStatuses.ACTIVE, actorId);
    ApiResponse.success(res, user, 'MR account activated');
  };

  public deactivate = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    const user = await this.users.setStatus(Number(req.params.id), UserStatuses.INACTIVE, actorId);
    ApiResponse.success(res, user, 'MR account deactivated');
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    const user = await this.users.resetPassword(
      Number(req.params.id),
      req.body as ResetPasswordDto,
      actorId,
    );
    ApiResponse.success(res, user, 'Password reset successfully');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actorId = this.requireActor(req);
    await this.users.deleteMr(Number(req.params.id), actorId);
    ApiResponse.success(res, null, 'MR account deleted');
  };

  private requireActor(req: Request): number {
    if (!req.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user.id;
  }
}
