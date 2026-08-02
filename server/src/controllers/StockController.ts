import type { Request, Response } from 'express';
import type { AdjustStockDto, ListStockQueryDto } from '../dto/stock.dto';
import { UnauthorizedError } from '../errors/AppError';
import { StockService } from '../services/StockService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

/**
 * StockController — HTTP adapters for stock operations.
 * Design Pattern: Singleton + Controller Layer
 */
export class StockController {
  private static instance: StockController | null = null;

  private constructor(private readonly stocks = StockService.getInstance()) {}

  public static getInstance(): StockController {
    if (!StockController.instance) {
      StockController.instance = new StockController();
    }
    return StockController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListStockQueryDto;
    const result = await this.stocks.list(query);
    ApiResponse.success(res, result.items, 'Stock retrieved', HttpStatus.OK, result.meta);
  };

  public adjust = async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new UnauthorizedError('Authentication required');
    const stock = await this.stocks.adjust(req.body as AdjustStockDto, req.user.id);
    ApiResponse.success(res, stock, 'Stock adjusted');
  };
}
