import type { Request, Response } from 'express';
import { DoctorService } from '../services/DoctorService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  AssignMrDto,
  CreateDoctorDto,
  ListDoctorsQueryDto,
  UpdateDoctorDto,
} from '../dto/doctor.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class DoctorController {
  private static instance: DoctorController | null = null;

  private constructor(private readonly doctors = DoctorService.getInstance()) {}

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
    const doctor = await this.doctors.getById(String(req.params.id), actor);
    ApiResponse.success(res, doctor, 'Doctor retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.create(req.body as CreateDoctorDto, actor);
    ApiResponse.created(res, doctor, 'Doctor created');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.update(
      String(req.params.id),
      req.body as UpdateDoctorDto,
      actor,
    );
    ApiResponse.success(res, doctor, 'Doctor updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    await this.doctors.remove(String(req.params.id), actor);
    ApiResponse.success(res, null, 'Doctor deleted');
  };

  public assignMr = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const doctor = await this.doctors.assignMr(
      String(req.params.id),
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
