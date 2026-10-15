import type { Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
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

  /** PATCH /notifications/:id/read — only db-backed ids (`db-<n>`) are mutable. */
  public markRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const raw = String(req.params.id ?? '');
    const match = /^(?:db-)?(\d+)$/.exec(raw);
    if (!match) {
      throw new BadRequestError('Only stored notifications can be marked read');
    }
    const row = await this.notifications.markRead(Number(match[1]), req.user);
    ApiResponse.success(res, row, 'Notification read');
  };

  public markAllRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const result = await this.notifications.markAllRead(req.user);
    ApiResponse.success(res, result, 'All notifications read');
  };
}
