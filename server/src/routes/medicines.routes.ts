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
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = MedicineController.getInstance();

// Every field role reads the product catalog (sample selection, POB, stock screens);
// only medicines:manage holders change it.
router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get('/', validateRequest(listMedicinesQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/:id/details', asyncHandler(controller.getDetails));
router.get('/:id', asyncHandler(controller.getById));

router.post(
  '/',
  requirePermission('medicines:manage'),
  validateRequest(createMedicineSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  requirePermission('medicines:manage'),
  validateRequest(updateMedicineSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', requirePermission('medicines:manage'), asyncHandler(controller.remove));

export default router;
