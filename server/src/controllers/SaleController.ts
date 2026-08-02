import type { Request, Response } from 'express';
import type { CreateSaleDto, ListSalesQueryDto } from '../dto/sale.dto';
import { UnauthorizedError } from '../errors/AppError';
import { SaleService } from '../services/SaleService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class SaleController {
  private static instance: SaleController | null = null;
  private constructor(private readonly sales = SaleService.getInstance()) {}
  public static getInstance(): SaleController {
    if (!SaleController.instance) SaleController.instance = new SaleController();
    return SaleController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListSalesQueryDto;
    const result = await this.sales.list(query, req.user);
    ApiResponse.success(res, result.items, 'Sales retrieved', HttpStatus.OK, result.meta);
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const sale = await this.sales.create(req.body as CreateSaleDto, req.user);
    ApiResponse.created(res, sale, 'Sale recorded');
  };
}
