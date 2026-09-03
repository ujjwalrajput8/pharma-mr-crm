import type { Request, Response } from 'express';
import type {
  ApplyLeaveDto,
  CancelLeaveDto,
  DecideLeaveDto,
  GrantCompOffDto,
  LeaveBalanceQueryDto,
  ListLeavesQueryDto,
  SetLeaveBalanceDto,
  UpdateLeaveTypeDto,
  UpsertLeaveTypeDto,
} from '../dto/leave.dto';
import { UnauthorizedError } from '../errors/AppError';
import { LeaveService } from '../services/LeaveService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class LeaveController {
  private static instance: LeaveController | null = null;
  private constructor(private readonly leaves = LeaveService.getInstance()) {}
  public static getInstance(): LeaveController {
    if (!LeaveController.instance) LeaveController.instance = new LeaveController();
    return LeaveController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListLeavesQueryDto;
    const result = await this.leaves.list(query, req.user);
    ApiResponse.success(res, result.items, 'Leave requests', HttpStatus.OK, result.meta);
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.getById(Number(req.params.id), req.user);
    ApiResponse.success(res, row, 'Leave request');
  };

  public apply = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.apply(req.body as ApplyLeaveDto, req.user);
    ApiResponse.success(res, row, 'Leave request submitted', HttpStatus.CREATED);
  };

  public decide = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.decide(
      Number(req.params.id),
      req.body as DecideLeaveDto,
      req.user,
    );
    ApiResponse.success(res, row, `Leave ${row.status.toLowerCase()}`);
  };

  public cancel = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.cancel(
      Number(req.params.id),
      req.body as CancelLeaveDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Leave cancelled');
  };

  public pendingCount = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const count = await this.leaves.pendingCount(req.user);
    ApiResponse.success(res, { count }, 'Pending leave count');
  };

  // ── Balances ───────────────────────────────────────────────────────────────

  public balances = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as LeaveBalanceQueryDto;
    const result = await this.leaves.balances(query, req.user);
    ApiResponse.success(res, result, 'Leave balances');
  };

  public grantCompOff = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.grantCompOff(req.body as GrantCompOffDto, req.user);
    ApiResponse.success(res, row, `${row.granted} comp-off day(s) granted to ${row.employeeName}`);
  };

  public setBalance = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.setBalance(req.body as SetLeaveBalanceDto, req.user);
    ApiResponse.success(res, row, 'Leave entitlement updated');
  };

  // ── Types ──────────────────────────────────────────────────────────────────

  public listTypes = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const includeInactive = req.query.includeInactive === 'true';
    const rows = await this.leaves.listTypes(includeInactive);
    ApiResponse.success(res, rows, 'Leave types');
  };

  public createType = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.createType(req.body as UpsertLeaveTypeDto, req.user);
    ApiResponse.success(res, row, 'Leave type created', HttpStatus.CREATED);
  };

  public updateType = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.leaves.updateType(
      Number(req.params.id),
      req.body as UpdateLeaveTypeDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Leave type updated');
  };

  public removeType = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    await this.leaves.removeType(Number(req.params.id), req.user);
    ApiResponse.success(res, null, 'Leave type removed');
  };
}
