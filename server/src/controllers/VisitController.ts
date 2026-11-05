import type { Request, Response } from 'express';
import { VisitService } from '../services/VisitService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  BulkVisitDto,
  CorrectVisitDto,
  CreateVisitDto,
  ListVisitsQueryDto,
  ReviewVisitDto,
  SampleCorrectionDto,
} from '../dto/visit.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class VisitController {
  private static instance: VisitController | null = null;

  private constructor(private readonly visits = VisitService.getInstance()) {}

  public static getInstance(): VisitController {
    if (!VisitController.instance) {
      VisitController.instance = new VisitController();
    }
    return VisitController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const query = (req.validatedQuery ?? req.query) as ListVisitsQueryDto;
    const result = await this.visits.list(query, actor);
    ApiResponse.success(res, result.items, 'Visits retrieved', HttpStatus.OK, result.meta);
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    ApiResponse.success(res, await this.visits.get(Number(req.params.id), actor), 'Visit retrieved');
  };

  public history = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    ApiResponse.success(res, await this.visits.history(Number(req.params.id), actor), 'Visit history');
  };

  /** 201 for a new visit; 200 when the same form (clientUuid) was already saved. */
  public create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.visits.record(req.body as CreateVisitDto, actor, { source: 'DIRECT' });
    const visit = await this.visits.get(result.visitId, actor);
    ApiResponse.success(
      res,
      { ...visit, replayed: result.replayed },
      result.replayed ? 'Visit already saved' : 'Visit logged',
      result.replayed ? HttpStatus.OK : HttpStatus.CREATED,
    );
  };

  public bulk = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.visits.bulk(req.body as BulkVisitDto, actor);
    ApiResponse.success(res, result, result.dryRun ? 'Preview' : 'Visits logged');
  };

  public correct = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const visit = await this.visits.correct(Number(req.params.id), req.body as CorrectVisitDto, actor);
    ApiResponse.success(res, visit, 'Visit corrected');
  };

  public sampleCorrection = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const visit = await this.visits.sampleCorrection(Number(req.params.id), req.body as SampleCorrectionDto, actor);
    ApiResponse.success(res, visit, 'Samples corrected');
  };

  public review = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const visit = await this.visits.review(Number(req.params.id), req.body as ReviewVisitDto, actor);
    ApiResponse.success(res, visit, 'Visit reviewed');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    await this.visits.remove(Number(req.params.id), actor);
  };

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
