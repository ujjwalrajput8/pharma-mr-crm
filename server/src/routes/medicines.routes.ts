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

// MR needs read access to select sample medicines during Complete + Visit.
router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MR));

router.get('/', validateRequest(listMedicinesQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/:id/details', asyncHandler(controller.getDetails));
router.get('/:id', asyncHandler(controller.getById));

router.post(
  '/',
  authorize(AppRoles.ADMIN),
  validateRequest(createMedicineSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  authorize(AppRoles.ADMIN),
  validateRequest(updateMedicineSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', authorize(AppRoles.ADMIN), asyncHandler(controller.remove));

export default router;
