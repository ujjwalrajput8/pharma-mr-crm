import { Router } from 'express';
import { VisitController } from '../controllers/VisitController';
import {
  bulkVisitSchema,
  correctVisitSchema,
  createVisitSchema,
  listVisitsQuerySchema,
  reviewVisitSchema,
  sampleCorrectionSchema,
} from '../dto/visit.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = VisitController.getInstance();

router.use(
  authenticate,
  authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR),
  requirePermission('visits:own', 'visits:manage'),
);

router.get('/', validateRequest(listVisitsQuerySchema, 'query'), asyncHandler(controller.list));
router.post('/', validateRequest(createVisitSchema), asyncHandler(controller.create));
router.post('/bulk', validateRequest(bulkVisitSchema), asyncHandler(controller.bulk));
router.get('/:id', asyncHandler(controller.get));
router.get('/:id/history', asyncHandler(controller.history));
router.patch('/:id', validateRequest(correctVisitSchema), asyncHandler(controller.correct));
router.post(
  '/:id/sample-correction',
  requirePermission('visits:manage'),
  validateRequest(sampleCorrectionSchema),
  asyncHandler(controller.sampleCorrection),
);
router.post(
  '/:id/review',
  requirePermission('visits:manage'),
  validateRequest(reviewVisitSchema),
  asyncHandler(controller.review),
);
// Always refused (409) — completed visits are corrected, never deleted.
router.delete('/:id', asyncHandler(controller.remove));

export default router;
