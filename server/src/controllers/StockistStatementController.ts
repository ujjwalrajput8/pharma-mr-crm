import type { Request, Response } from 'express';
import type { SaveStatementDto, StatementSummaryQueryDto } from '../dto/stockist-statement.dto';
import { UnauthorizedError } from '../errors/AppError';
import { StockistStatementService } from '../services/StockistStatementService';
import type { AuthUser } from '../types/auth.types';
import { ApiResponse } from '../utils/ApiResponse';

export class StockistStatementController {
  private static instance: StockistStatementController | null = null;

  private constructor(private readonly statements = StockistStatementService.getInstance()) {}

  public static getInstance(): StockistStatementController {
    if (!StockistStatementController.instance) {
      StockistStatementController.instance = new StockistStatementController();
    }
    return StockistStatementController.instance;
  }

  public stockists = async (req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, await this.statements.stockists(this.requireUser(req)), 'Stockists');
  };

  public overview = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as { month: string };
    ApiResponse.success(res, await this.statements.overview(query.month, this.requireUser(req)), 'Statement overview');
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as { storeId: number; month: string };
    ApiResponse.success(res, await this.statements.get(query.storeId, query.month, this.requireUser(req)), 'Stockist statement');
  };

  public save = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as SaveStatementDto;
    const saved = await this.statements.save(body, this.requireUser(req));
    ApiResponse.success(res, saved, saved.status === 'SUBMITTED' ? 'Statement submitted' : 'Statement saved');
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as StatementSummaryQueryDto;
    ApiResponse.success(res, await this.statements.summary(query, this.requireUser(req)), 'Statement summary');
  };

  private requireUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
