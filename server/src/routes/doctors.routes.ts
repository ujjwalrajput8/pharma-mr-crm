import { Router } from 'express';
import { DoctorController } from '../controllers/DoctorController';
import {
  assignMrSchema,
  bulkAssignMrSchema,
  createDoctorSchema,
  importDoctorsSchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from '../dto/doctor.dto';
import { lookupDoctorsQuerySchema } from '../dto/visit.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = DoctorController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

router.get('/', validateRequest(listDoctorsQuerySchema, 'query'), asyncHandler(controller.list));
// Fixed paths before '/:id'.
router.get(
  '/lookup',
  requirePermission('visits:own', 'visits:manage'),
  validateRequest(lookupDoctorsQuerySchema, 'query'),
  asyncHandler(controller.lookup),
);
router.get(
  '/mr-options',
  authorize(AppRoles.ADMIN, AppRoles.MANAGER),
  asyncHandler(controller.mrOptions),
);
router.get('/:id/assignment-history', asyncHandler(controller.assignmentHistory));
router.get('/:id/details', asyncHandler(controller.getDetails));
router.get('/:id', asyncHandler(controller.getById));

// Every role stars doctors for themselves (an MR only among their own doctors).
router.put('/:id/favorite', asyncHandler(controller.favorite));
router.delete('/:id/favorite', asyncHandler(controller.unfavorite));

router.post(
  '/',
  authorize(AppRoles.ADMIN),
  validateRequest(createDoctorSchema),
  asyncHandler(controller.create),
);
router.post(
  '/assign-mr',
  authorize(AppRoles.ADMIN),
  validateRequest(bulkAssignMrSchema),
  asyncHandler(controller.bulkAssignMr),
);
router.post(
  '/import',
  authorize(AppRoles.ADMIN),
  validateRequest(importDoctorsSchema),
  asyncHandler(controller.import),
);
router.patch(
  '/:id',
  authorize(AppRoles.ADMIN),
  validateRequest(updateDoctorSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', authorize(AppRoles.ADMIN), asyncHandler(controller.remove));
router.post(
  '/:id/assign-mr',
  authorize(AppRoles.ADMIN),
  validateRequest(assignMrSchema),
  asyncHandler(controller.assignMr),
);

export default router;
