import { Router } from 'express';
import { MedicineController } from '../controllers/MedicineController';
import {
  createMedicineSchema,
  listMedicinesQuerySchema,
  updateMedicineSchema,
} from '../dto/medicine.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = MedicineController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN));

router.get('/', validateRequest(listMedicinesQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', validateRequest(createMedicineSchema), asyncHandler(controller.create));
router.patch('/:id', validateRequest(updateMedicineSchema), asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
