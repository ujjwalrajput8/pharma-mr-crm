import type { Request, Response } from 'express';
import type {
  LedgerStatementQueryDto,
  ListLedgerReceiptsQueryDto,
  ListLedgerTxnsQueryDto,
} from '../dto/ledger.dto';
import { LedgerQueryService } from '../services/LedgerQueryService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

/**
 * LedgerController — HTTP adapters for the read-only stock ledger explorer.
 * Design Pattern: Singleton + Controller Layer
 */
export class LedgerController {
  private static instance: LedgerController | null = null;

  private constructor(private readonly ledger = LedgerQueryService.getInstance()) {}

  public static getInstance(): LedgerController {
    if (!LedgerController.instance) {
      LedgerController.instance = new LedgerController();
    }
    return LedgerController.instance;
  }

  public listTxns = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListLedgerTxnsQueryDto;
    const result = await this.ledger.listTxns(query);
    ApiResponse.success(res, { items: result.items, summary: result.summary }, 'Ledger transactions retrieved', HttpStatus.OK, result.meta);
  };

  public listReceipts = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListLedgerReceiptsQueryDto;
    const result = await this.ledger.listReceipts(query);
    ApiResponse.success(res, result.items, 'Stock receipts retrieved', HttpStatus.OK, result.meta);
  };

  public getReceipt = async (req: Request, res: Response): Promise<void> => {
    const result = await this.ledger.getReceipt(Number(req.params.id));
    ApiResponse.success(res, result, 'Stock receipt retrieved');
  };

  public statement = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as LedgerStatementQueryDto;
    const result = await this.ledger.statement(query);
    ApiResponse.success(res, result, 'Ledger statement ready');
  };
}
