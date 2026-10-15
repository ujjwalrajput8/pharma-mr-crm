import type { Request, Response } from 'express';
import type {
  DecideTourPlanDto,
  ListTourPlansQueryDto,
  TourPlanMonthQueryDto,
  UpsertMyTourPlanDto,
} from '../dto/tour-plan.dto';
import { UnauthorizedError } from '../errors/AppError';
import { TourPlanService } from '../services/TourPlanService';
import { ApiResponse } from '../utils/ApiResponse';

export class TourPlanController {
  private static instance: TourPlanController | null = null;
  private constructor(private readonly tourPlans = TourPlanService.getInstance()) {}
  public static getInstance(): TourPlanController {
    if (!TourPlanController.instance) TourPlanController.instance = new TourPlanController();
    return TourPlanController.instance;
  }

  public my = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { month } = (req.validatedQuery ?? req.query) as TourPlanMonthQueryDto;
    const result = await this.tourPlans.getMyPlan(month, req.user);
    ApiResponse.success(res, result, 'My tour plan');
  };

  public saveMy = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { month } = (req.validatedQuery ?? req.query) as TourPlanMonthQueryDto;
    const row = await this.tourPlans.saveMyPlan(month, req.body as UpsertMyTourPlanDto, req.user);
    ApiResponse.success(res, row, 'Tour plan saved');
  };

  public submitMy = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { month } = (req.validatedQuery ?? req.query) as TourPlanMonthQueryDto;
    const row = await this.tourPlans.submitMyPlan(month, req.user);
    ApiResponse.success(res, row, 'Tour plan submitted for approval');
  };

  public today = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const day = await this.tourPlans.todayForActor(req.user);
    ApiResponse.success(res, day, "Today's plan");
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListTourPlansQueryDto;
    const rows = await this.tourPlans.listTeam(query, req.user);
    ApiResponse.success(res, rows, 'Tour plans');
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.tourPlans.getById(Number(req.params.id), req.user);
    ApiResponse.success(res, row, 'Tour plan');
  };

  public decide = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.tourPlans.decide(
      Number(req.params.id),
      req.body as DecideTourPlanDto,
      req.user,
    );
    ApiResponse.success(res, row, `Tour plan ${row.status.toLowerCase()}`);
  };
}
