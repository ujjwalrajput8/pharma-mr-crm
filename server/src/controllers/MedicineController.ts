import type { Request, Response } from 'express';
import { MedicineService } from '../services/MedicineService';
import { ApiResponse } from '../utils/ApiResponse';
import type {
  CreateMedicineDto,
  ListMedicinesQueryDto,
  UpdateMedicineDto,
} from '../dto/medicine.dto';
import { UnauthorizedError } from '../errors/AppError';
import { HttpStatus } from '../constants';

export class MedicineController {
  private static instance: MedicineController | null = null;

  private constructor(private readonly medicines = MedicineService.getInstance()) {}

  public static getInstance(): MedicineController {
    if (!MedicineController.instance) {
      MedicineController.instance = new MedicineController();
    }
    return MedicineController.instance;
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = (req.validatedQuery ?? req.query) as ListMedicinesQueryDto;
    const result = await this.medicines.list(query);
    ApiResponse.success(res, result.items, 'Medicines retrieved', HttpStatus.OK, result.meta);
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const medicine = await this.medicines.getById(String(req.params.id));
    ApiResponse.success(res, medicine, 'Medicine retrieved');
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const medicine = await this.medicines.create(
      req.body as CreateMedicineDto,
      this.requireActor(req),
    );
    ApiResponse.created(res, medicine, 'Medicine created');
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const medicine = await this.medicines.update(
      String(req.params.id),
      req.body as UpdateMedicineDto,
      this.requireActor(req),
    );
    ApiResponse.success(res, medicine, 'Medicine updated');
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    await this.medicines.remove(String(req.params.id), this.requireActor(req));
    ApiResponse.success(res, null, 'Medicine deleted');
  };

  private requireActor(req: Request): string {
    if (!req.user?.id) throw new UnauthorizedError('Authentication required');
    return req.user.id;
  }
}
