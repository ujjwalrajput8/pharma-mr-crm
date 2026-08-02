import type { Request, Response } from 'express';
import type { CreateMedicineIssueDto, ListMedicineIssuesQueryDto } from '../dto/medicine-issue.dto';
import { UnauthorizedError } from '../errors/AppError';
import { MedicineIssueService } from '../services/MedicineIssueService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class MedicineIssueController {
  private static instance: MedicineIssueController | null = null;
  private constructor(private readonly issues = MedicineIssueService.getInstance()) {}
  public static getInstance(): MedicineIssueController {
    if (!MedicineIssueController.instance) {
      MedicineIssueController.instance = new MedicineIssueController();
    }
    return MedicineIssueController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListMedicineIssuesQueryDto;
    const result = await this.issues.list(query, req.user);
    ApiResponse.success(res, result.items, 'Medicine issues retrieved', HttpStatus.OK, result.meta);
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const issue = await this.issues.create(req.body as CreateMedicineIssueDto, req.user);
    ApiResponse.created(res, issue, 'Medicine issued to MR');
  };
}
