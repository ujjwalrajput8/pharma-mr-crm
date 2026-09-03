import type { Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { NotificationService } from '../services/NotificationService';
import { ApiResponse } from '../utils/ApiResponse';

export class NotificationController {
  private static instance: NotificationController | null = null;
  private constructor(private readonly notifications = NotificationService.getInstance()) {}
  public static getInstance(): NotificationController {
    if (!NotificationController.instance) {
      NotificationController.instance = new NotificationController();
    }
    return NotificationController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const result = await this.notifications.list(req.user);
    ApiResponse.success(res, result, 'Notifications');
  };
}
