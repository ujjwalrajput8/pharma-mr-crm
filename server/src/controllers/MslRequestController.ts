import type { Request, Response } from 'express';
import type { CreateMslRequestDto, DecideMslRequestDto, ListMslRequestsQueryDto } from '../dto/msl.dto';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';
import { MslRequestService } from '../services/MslRequestService';
import { MyApprovalsService } from '../services/MyApprovalsService';
import type { AuthUser } from '../types/auth.types';
import { ApiResponse } from '../utils/ApiResponse';

export class MslRequestController {
  private static instance: MslRequestController | null = null;

  private constructor(
    private readonly requests = MslRequestService.getInstance(),
    private readonly approvals = MyApprovalsService.getInstance(),
  ) {}

  public static getInstance(): MslRequestController {
    if (!MslRequestController.instance) {
      MslRequestController.instance = new MslRequestController();
    }
    return MslRequestController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListMslRequestsQueryDto;
    const result = await this.requests.list(query, this.requireUser(req));
    ApiResponse.success(res, result.items, 'MSL requests', HttpStatus.OK, result.meta);
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const row = await this.requests.create(req.body as CreateMslRequestDto, this.requireUser(req));
    ApiResponse.created(res, row, 'Request sent to your manager');
  };

  public cancel = async (req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, await this.requests.cancel(this.id(req), this.requireUser(req)), 'Request cancelled');
  };

  public decide = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as DecideMslRequestDto;
    const row = await this.requests.decide(this.id(req), body, this.requireUser(req));
    ApiResponse.success(res, row, body.action === 'APPROVE' ? 'Request approved' : 'Request rejected');
  };

  public myApprovals = async (req: Request, res: Response): Promise<void> => {
    const result = await this.approvals.mine(this.requireUser(req));
    ApiResponse.success(res, result.items, 'My approvals', HttpStatus.OK, result.meta);
  };

  private id(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('Invalid request id');
    return id;
  }

  private requireUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
