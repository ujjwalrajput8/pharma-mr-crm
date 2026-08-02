import type { Request, Response } from 'express';
import type { ListAuditLogsQueryDto } from '../dto/audit.dto';
import { AuditService } from '../services/AuditService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class AuditController {
  private static instance: AuditController | null = null;

  private constructor(private readonly audits = AuditService.getInstance()) {}

  public static getInstance(): AuditController {
    if (!AuditController.instance) {
      AuditController.instance = new AuditController();
    }
    return AuditController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListAuditLogsQueryDto;
    const result = await this.audits.list(query);
    ApiResponse.success(res, result.items, 'Audit logs retrieved', HttpStatus.OK, result.meta);
  };
}
