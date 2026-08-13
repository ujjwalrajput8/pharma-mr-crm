import type { Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import type { SetManagerPermissionsDto } from '../dto/permission.dto';
import { PermissionService } from '../services/PermissionService';
import type { AuthUser } from '../types/auth.types';
import { ApiResponse } from '../utils/ApiResponse';

export class PermissionController {
  private static instance: PermissionController | null = null;

  private constructor(private readonly permissions = PermissionService.getInstance()) {}

  public static getInstance(): PermissionController {
    if (!PermissionController.instance) {
      PermissionController.instance = new PermissionController();
    }
    return PermissionController.instance;
  }

  public catalog = async (_req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, this.permissions.catalog(), 'Permission catalog');
  };

  public listManagers = async (req: Request, res: Response): Promise<void> => {
    const items = await this.permissions.listManagers(this.requireActor(req));
    ApiResponse.success(res, items, 'Managers retrieved');
  };

  public getManager = async (req: Request, res: Response): Promise<void> => {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) throw new BadRequestError('Invalid manager id');
    const state = await this.permissions.getManagerPermissionState(
      userId,
      this.requireActor(req),
    );
    ApiResponse.success(res, state, 'Manager permissions retrieved');
  };

  public setManager = async (req: Request, res: Response): Promise<void> => {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) throw new BadRequestError('Invalid manager id');
    const body = req.body as SetManagerPermissionsDto;
    const state = await this.permissions.setManagerPermissions(
      userId,
      body.permissions,
      this.requireActor(req),
    );
    ApiResponse.success(res, state, 'Manager permissions updated');
  };

  public resetManager = async (req: Request, res: Response): Promise<void> => {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) throw new BadRequestError('Invalid manager id');
    const state = await this.permissions.resetManagerPermissions(
      userId,
      this.requireActor(req),
    );
    ApiResponse.success(res, state, 'Manager permissions reset to defaults');
  };

  private requireActor(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
