import type { Request, Response } from 'express';
import type {
  CreateExpenseDto,
  DecideExpenseDto,
  ExpenseSummaryQueryDto,
  ListExpensesQueryDto,
  UpdateExpenseDto,
} from '../dto/expense.dto';
import { UnauthorizedError } from '../errors/AppError';
import { ExpenseService } from '../services/ExpenseService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class ExpenseController {
  private static instance: ExpenseController | null = null;
  private constructor(private readonly expenses = ExpenseService.getInstance()) {}
  public static getInstance(): ExpenseController {
    if (!ExpenseController.instance) ExpenseController.instance = new ExpenseController();
    return ExpenseController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListExpensesQueryDto;
    const result = await this.expenses.list(query, req.user);
    ApiResponse.success(res, result.items, 'Expense claims', HttpStatus.OK, result.meta);
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.expenses.create(req.body as CreateExpenseDto, req.user);
    ApiResponse.success(res, row, 'Expense claim submitted', HttpStatus.CREATED);
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.expenses.update(
      Number(req.params.id),
      req.body as UpdateExpenseDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Expense claim updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    await this.expenses.remove(Number(req.params.id), req.user);
    ApiResponse.success(res, null, 'Expense claim deleted');
  };

  public decide = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.expenses.decide(
      Number(req.params.id),
      req.body as DecideExpenseDto,
      req.user,
    );
    ApiResponse.success(res, row, `Expense ${row.status.toLowerCase()}`);
  };

  public markPaid = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.expenses.markPaid(Number(req.params.id), req.user);
    ApiResponse.success(res, row, 'Expense marked paid');
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ExpenseSummaryQueryDto;
    const result = await this.expenses.summary(query, req.user);
    ApiResponse.success(res, result, 'Expense summary');
  };
}
