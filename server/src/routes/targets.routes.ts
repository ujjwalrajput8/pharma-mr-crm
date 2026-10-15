import { Router } from 'express';
import { TargetController } from '../controllers/TargetController';
import {
  listTargetsQuerySchema,
  targetProgressQuerySchema,
  upsertTargetSchema,
} from '../dto/target.dto';
import { AppRoles } from '../constants';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const controller = TargetController.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

/** MRs may read their own progress; the service pins non-managers to self. */
router.get(
  '/progress',
  requirePermission('targets:manage', 'sales:own'),
  validateRequest(targetProgressQuerySchema, 'query'),
  asyncHandler(controller.progress),
);

router.get(
  '/',
  requirePermission('targets:manage'),
  validateRequest(listTargetsQuerySchema, 'query'),
  asyncHandler(controller.list),
);
router.post(
  '/',
  requirePermission('targets:manage'),
  validateRequest(upsertTargetSchema),
  asyncHandler(controller.upsert),
);
router.delete('/:id', requirePermission('targets:manage'), asyncHandler(controller.remove));

export default router;
