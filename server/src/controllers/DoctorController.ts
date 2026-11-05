import type { Request, Response } from 'express';
import { DoctorImportService } from '../services/DoctorImportService';
import { DoctorService } from '../services/DoctorService';
import { VisitService } from '../services/VisitService';
import type { LookupDoctorsQueryDto } from '../dto/visit.dto';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  AssignMrDto,
  BulkAssignMrDto,
  CreateDoctorDto,
  ImportDoctorsDto,
  ListDoctorsQueryDto,
  UpdateDoctorDto,
} from '../dto/doctor.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class DoctorController {
  private static instance: DoctorController | null = null;

  private constructor(
    private readonly doctors = DoctorService.getInstance(),
    private readonly importer = DoctorImportService.getInstance(),
    private readonly visits = VisitService.getInstance(),
  ) {}

  public static getInstance(): DoctorController {
    if (!DoctorController.instance) {
      DoctorController.instance = new DoctorController();
    }
    return DoctorController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const query = (req.validatedQuery ?? req.query) as ListDoctorsQueryDto;
    const result = await this.doctors.list(query, actor);
    ApiResponse.success(res, result.items, 'Doctors retrieved', HttpStatus.OK, result.meta);
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.getById(Number(req.params.id), actor);
    ApiResponse.success(res, doctor, 'Doctor retrieved');
  };

  public getDetails = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const details = await this.doctors.getDetails(Number(req.params.id), actor);
    ApiResponse.success(res, details, 'Doctor details retrieved');
  };

  /** "Search all doctors" for the visit form (unlisted doctors included). */
  public lookup = async (req: Request, res: Response): Promise<void> => {
    this.requireUser(req);
    const query = (req.validatedQuery ?? req.query) as LookupDoctorsQueryDto;
    ApiResponse.success(res, await this.visits.lookupDoctors(query), 'Doctors found');
  };

  /** MR picker: name, code, photo, team line, area, doctor count. */
  public mrOptions = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    ApiResponse.success(res, await this.doctors.mrOptions(actor, search), 'MR options');
  };

  public assignmentHistory = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const history = await this.doctors.assignmentHistory(Number(req.params.id), actor);
    ApiResponse.success(res, history, 'Assignment history');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.create(req.body as CreateDoctorDto, actor);
    ApiResponse.created(res, doctor, 'Doctor created');
  };

  public import = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.importer.import(req.body as ImportDoctorsDto, actor.id);
    ApiResponse.success(res, result, 'Doctors imported');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.update(
      Number(req.params.id),
      req.body as UpdateDoctorDto,
      actor,
    );
    ApiResponse.success(res, doctor, 'Doctor updated');
  };

  public bulkAssignMr = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.doctors.bulkAssignMr(req.body as BulkAssignMrDto, actor);
    ApiResponse.success(
      res,
      result,
      result.mr ? `${result.doctors} doctor(s) assigned to ${result.mr.fullName}` : `${result.doctors} doctor(s) unassigned`,
    );
  };

  public favorite = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.doctors.setFavorite(Number(req.params.id), true, actor);
    ApiResponse.success(res, result, 'Doctor added to favourites');
  };

  public unfavorite = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.doctors.setFavorite(Number(req.params.id), false, actor);
    ApiResponse.success(res, result, 'Doctor removed from favourites');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    await this.doctors.remove(Number(req.params.id), actor);
    ApiResponse.success(res, null, 'Doctor deleted');
  };

  public assignMr = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.assignMr(
      Number(req.params.id),
      req.body as AssignMrDto,
      actor,
    );
    ApiResponse.success(res, doctor, 'MR assigned to doctor');
  };

  private requireUser(req: Request) {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }
}
