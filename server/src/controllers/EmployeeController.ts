import type { Request, Response } from 'express';
import type {
  EmployeeProfileQueryDto,
  ListEmployeesQueryDto,
  UpdateEmployeeProfileDto,
} from '../dto/employee.dto';
import { UnauthorizedError } from '../errors/AppError';
import { EmployeeService } from '../services/EmployeeService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class EmployeeController {
  private static instance: EmployeeController | null = null;
  private constructor(private readonly employees = EmployeeService.getInstance()) {}
  public static getInstance(): EmployeeController {
    if (!EmployeeController.instance) EmployeeController.instance = new EmployeeController();
    return EmployeeController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListEmployeesQueryDto;
    const result = await this.employees.list(query, req.user);
    ApiResponse.success(res, result.items, 'Employees', HttpStatus.OK, result.meta);
  };

  /** Own profile — every role can read this one. */
  public me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as EmployeeProfileQueryDto;
    const row = await this.employees.profile(req.user.id, query, req.user);
    ApiResponse.success(res, row, 'My employee profile');
  };

  public profile = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as EmployeeProfileQueryDto;
    const row = await this.employees.profile(Number(req.params.id), query, req.user);
    ApiResponse.success(res, row, 'Employee profile');
  };

  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.employees.updateProfile(
      Number(req.params.id),
      req.body as UpdateEmployeeProfileDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Employee record updated');
  };
}
