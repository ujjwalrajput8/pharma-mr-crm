import type { Request, Response } from 'express';
import type {
  CreateInvoiceDto,
  InvoiceSummaryQueryDto,
  ListInvoicesQueryDto,
  RecordPaymentDto,
} from '../dto/invoice.dto';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import { InvoiceService } from '../services/InvoiceService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

function parseId(raw: string | string[] | undefined, label = 'id'): number {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError(`Invalid ${label}`);
  return id;
}

export class InvoiceController {
  private static instance: InvoiceController | null = null;
  private constructor(private readonly invoices = InvoiceService.getInstance()) {}
  public static getInstance(): InvoiceController {
    if (!InvoiceController.instance) InvoiceController.instance = new InvoiceController();
    return InvoiceController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListInvoicesQueryDto;
    const result = await this.invoices.list(query, req.user);
    ApiResponse.success(res, result.items, 'Invoices retrieved', HttpStatus.OK, result.meta);
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const invoice = await this.invoices.getById(parseId(req.params.id), req.user);
    ApiResponse.success(res, invoice, 'Invoice retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const invoice = await this.invoices.create(req.body as CreateInvoiceDto, req.user);
    ApiResponse.created(res, invoice, 'Invoice created');
  };

  public addPayment = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const invoice = await this.invoices.addPayment(
      parseId(req.params.id),
      req.body as RecordPaymentDto,
      req.user,
    );
    ApiResponse.created(res, invoice, 'Payment recorded');
  };

  public removePayment = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const invoice = await this.invoices.removePayment(
      parseId(req.params.id),
      parseId(req.params.paymentId, 'payment id'),
      req.user,
    );
    ApiResponse.success(res, invoice, 'Payment removed');
  };

  public cancel = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const invoice = await this.invoices.cancel(parseId(req.params.id), req.user);
    ApiResponse.success(res, invoice, 'Invoice cancelled');
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as InvoiceSummaryQueryDto;
    const result = await this.invoices.summary(query, req.user);
    ApiResponse.success(res, result, 'Billing summary retrieved');
  };
}
