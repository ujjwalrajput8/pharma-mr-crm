import type { Request, Response } from 'express';
import { AppointmentService } from '../services/AppointmentService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  CompleteAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class AppointmentController {
  private static instance: AppointmentController | null = null;

  private constructor(private readonly appointments = AppointmentService.getInstance()) {}

  public static getInstance(): AppointmentController {
    if (!AppointmentController.instance) {
      AppointmentController.instance = new AppointmentController();
    }
    return AppointmentController.instance;
  }

  public listAssignableMrs = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const items = await this.appointments.listAssignableMrs(actor);
    ApiResponse.success(res, items, 'Assignable MRs retrieved');
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const query = (req.validatedQuery ?? req.query) as ListAppointmentsQueryDto;
    const result = await this.appointments.list(query, actor);
    ApiResponse.success(res, result.items, 'Appointments retrieved', HttpStatus.OK, result.meta);
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const appointment = await this.appointments.create(req.body as CreateAppointmentDto, actor);
    ApiResponse.created(res, appointment, 'Appointment created');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const appointment = await this.appointments.update(
      Number(req.params.id),
      req.body as UpdateAppointmentDto,
      actor,
    );
    ApiResponse.success(res, appointment, 'Appointment updated');
  };

  public reschedule = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const appointment = await this.appointments.reschedule(
      Number(req.params.id),
      req.body as RescheduleAppointmentDto,
      actor,
    );
    ApiResponse.success(res, appointment, 'Appointment rescheduled');
  };

  public complete = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    const result = await this.appointments.completeWithVisit(
      Number(req.params.id),
      req.body as CompleteAppointmentDto,
      actor,
    );
    ApiResponse.success(res, result, 'Appointment completed and visit logged');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireUser(req);
    await this.appointments.remove(Number(req.params.id), actor);
    ApiResponse.success(res, null, 'Appointment deleted');
  };

  private requireUser(req: Request) {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    return req.user;
  }
}
