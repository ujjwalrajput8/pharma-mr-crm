import type { Request, Response } from 'express';
import type {
  AttendanceCalendarQueryDto,
  AttendanceSummaryQueryDto,
  CheckInDto,
  CheckOutDto,
  ListAttendanceQueryDto,
  ManageAttendanceDto,
  ReviewFlagDto,
} from '../dto/attendance.dto';
import { UnauthorizedError } from '../errors/AppError';
import { AttendanceService } from '../services/AttendanceService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class AttendanceController {
  private static instance: AttendanceController | null = null;
  private constructor(private readonly attendance = AttendanceService.getInstance()) {}
  public static getInstance(): AttendanceController {
    if (!AttendanceController.instance) AttendanceController.instance = new AttendanceController();
    return AttendanceController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as ListAttendanceQueryDto;
    const result = await this.attendance.list(query, req.user);
    ApiResponse.success(res, result.items, 'Attendance retrieved', HttpStatus.OK, result.meta);
  };

  public today = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.attendance.today(req.user);
    ApiResponse.success(res, row, 'Today attendance');
  };

  public checkIn = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.attendance.checkIn(req.body as CheckInDto, req.user);
    ApiResponse.success(res, row, 'Checked in');
  };

  public checkOut = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.attendance.checkOut(req.body as CheckOutDto, req.user);
    ApiResponse.success(res, row, 'Checked out');
  };

  public manage = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.attendance.manage(req.body as ManageAttendanceDto, req.user);
    ApiResponse.success(res, row, 'Attendance updated');
  };

  public fieldUsers = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const rows = await this.attendance.fieldUsers(req.user);
    ApiResponse.success(res, rows, 'Field users');
  };

  public reviewFlag = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const row = await this.attendance.reviewFlag(
      Number(req.params.id),
      req.body as ReviewFlagDto,
      req.user,
    );
    ApiResponse.success(res, row, 'Flag cleared');
  };

  public calendar = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as AttendanceCalendarQueryDto;
    const result = await this.attendance.calendar(query, req.user);
    ApiResponse.success(res, result, 'Attendance calendar');
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const query = (req.validatedQuery ?? req.query) as AttendanceSummaryQueryDto;
    const result = await this.attendance.summary(query, req.user);
    ApiResponse.success(res, result, 'Attendance summary');
  };
}
